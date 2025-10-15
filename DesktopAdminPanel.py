"""
Cusumano Desktop Admin Panel (single-file)
-------------------------------------------------
Features:
- Login with Firebase Auth (email/password)
- Firestore CRUD via REST (respects your Firestore security rules)
- Firebase Storage upload (with download URL)
- JSON editors for: siteContent, siteSettings, sliderImages, serviceGroups

Configuration:
- Set environment variables (recommended):
  FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
  or edit the constants below.

Security notes:
- Do NOT embed service account credentials in a desktop app.
- This app uses Firebase user ID tokens and your Firestore Rules for access control.
"""

import os
import json
import time
import uuid
import base64
import threading
from typing import Any, Dict, List
from urllib.parse import quote

import requests
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

try:
	from PIL import Image
except Exception:  # Pillow optional but recommended for image optimization
	Image = None  # type: ignore


# -------------------- Configuration --------------------
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "cusumano-website")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "cusumano-website.appspot.com")

# Collections commonly used in your web admin and rules
DEFAULT_COLLECTIONS = [
	"siteContent",
	"siteSettings",
	"sliderImages",
	"serviceGroups",
]


# -------------------- Firebase REST Client --------------------
class FirebaseClient:
	def __init__(self, api_key: str, project_id: str, storage_bucket: str):
		self.api_key = api_key
		self.project_id = project_id
		self.storage_bucket = storage_bucket
		self.id_token: str | None = None
		self.refresh_token: str | None = None
		self.local_id: str | None = None
		self.token_expiry_epoch: int = 0
		self._refresh_lock = threading.Lock()

	# ---------- Auth ----------
	def sign_in(self, email: str, password: str) -> Dict[str, Any]:
		url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={self.api_key}"
		payload = {"email": email, "password": password, "returnSecureToken": True}
		r = requests.post(url, json=payload, timeout=30)
		if r.status_code != 200:
			raise RuntimeError(f"Sign-in failed: {r.status_code} {r.text}")
		data = r.json()
		self.id_token = data["idToken"]
		self.refresh_token = data["refreshToken"]
		self.local_id = data["localId"]
		expires_in = int(data.get("expiresIn", "3600"))
		self.token_expiry_epoch = int(time.time()) + expires_in - 60  # refresh 60s early
		return data

	def _refresh_if_needed(self) -> None:
		if not self.id_token or time.time() < self.token_expiry_epoch:
			return
		with self._refresh_lock:
			if time.time() < self.token_expiry_epoch:
				return
			self.refresh_id_token()

	def refresh_id_token(self) -> None:
		if not self.refresh_token:
			return
		url = f"https://securetoken.googleapis.com/v1/token?key={self.api_key}"
		payload = {"grant_type": "refresh_token", "refresh_token": self.refresh_token}
		r = requests.post(url, data=payload, timeout=30)
		if r.status_code != 200:
			raise RuntimeError(f"Token refresh failed: {r.status_code} {r.text}")
		data = r.json()
		self.id_token = data["id_token"]
		self.refresh_token = data["refresh_token"]
		expires_in = int(data.get("expires_in", "3600"))
		self.token_expiry_epoch = int(time.time()) + expires_in - 60

	def is_admin_claim(self) -> bool:
		# Decode JWT payload (no verification) to check for custom claim { admin: true }
		if not self.id_token:
			return False
		try:
			parts = self.id_token.split(".")
			if len(parts) != 3:
				return False
			payload_b64 = parts[1]
			# Proper base64 padding
			pad = '=' * (-len(payload_b64) % 4)
			payload_json = base64.urlsafe_b64decode(payload_b64 + pad).decode()
			payload = json.loads(payload_json)
			return bool(payload.get("admin") is True)
		except Exception:
			return False

	# ---------- Firestore ----------
	@property
	def _fs_base(self) -> str:
		return f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"

	def _auth_headers(self) -> Dict[str, str]:
		self._refresh_if_needed()
		return {"Authorization": f"Bearer {self.id_token}"} if self.id_token else {}

	def list_documents(self, collection: str, page_size: int = 50) -> List[Dict[str, Any]]:
		url = f"{self._fs_base}/{collection}?pageSize={page_size}"
		r = requests.get(url, headers=self._auth_headers(), timeout=30)
		if r.status_code == 404:
			return []
		if r.status_code != 200:
			raise RuntimeError(f"List docs failed: {r.status_code} {r.text}")
		data = r.json()
		docs = data.get("documents", [])
		return [self._from_firestore_document(d) for d in docs]

	def get_document(self, collection: str, doc_id: str) -> Dict[str, Any] | None:
		url = f"{self._fs_base}/{collection}/{quote(doc_id, safe='')}"
		r = requests.get(url, headers=self._auth_headers(), timeout=30)
		if r.status_code == 404:
			return None
		if r.status_code != 200:
			raise RuntimeError(f"Get doc failed: {r.status_code} {r.text}")
		return self._from_firestore_document(r.json())

	def create_document(self, collection: str, doc_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
		url = f"{self._fs_base}/{collection}?documentId={quote(doc_id, safe='')}"
		body = {"fields": to_firestore_fields(content)}
		r = requests.post(url, headers=self._auth_headers(), json=body, timeout=30)
		if r.status_code not in (200, 201):
			raise RuntimeError(f"Create doc failed: {r.status_code} {r.text}")
		return self._from_firestore_document(r.json())

	def update_document(self, collection: str, doc_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
		url = f"{self._fs_base}/{collection}/{quote(doc_id, safe='')}"
		body = {"fields": to_firestore_fields(content)}
		field_paths = sorted(set(flatten_field_paths(content)))
		params = "&".join([f"updateMask.fieldPaths={quote(p, safe='')}" for p in field_paths]) if field_paths else ""
		if params:
			url = f"{url}?{params}"
		r = requests.patch(url, headers=self._auth_headers(), json=body, timeout=30)
		if r.status_code != 200:
			raise RuntimeError(f"Update doc failed: {r.status_code} {r.text}")
		return self._from_firestore_document(r.json())

	def delete_document(self, collection: str, doc_id: str) -> bool:
		url = f"{self._fs_base}/{collection}/{quote(doc_id, safe='')}"
		r = requests.delete(url, headers=self._auth_headers(), timeout=30)
		if r.status_code not in (200, 204):
			raise RuntimeError(f"Delete doc failed: {r.status_code} {r.text}")
		return True

	# ---------- Storage (Firebase Storage REST v0) ----------
	def upload_file(self, local_path: str, dest_path: str, content_type: str | None = None) -> str:
		"""
		Upload a local file to Firebase Storage and return a public download URL with token.
		"""
		self._refresh_if_needed()
		if not os.path.isfile(local_path):
			raise FileNotFoundError(local_path)
		token = str(uuid.uuid4())
		metadata = {"name": dest_path, "metadata": {"firebaseStorageDownloadTokens": token}}

		if content_type is None:
			ext = os.path.splitext(local_path)[1].lower()
			if ext in (".jpg", ".jpeg"):
				content_type = "image/jpeg"
			elif ext in (".png", ):
				content_type = "image/png"
			elif ext in (".webp", ):
				content_type = "image/webp"
			else:
				content_type = "application/octet-stream"

		url = f"https://firebasestorage.googleapis.com/v0/b/{self.storage_bucket}/o?name={quote(dest_path, safe='')}"
		headers = {"Authorization": f"Firebase {self.id_token}"}

		with open(local_path, "rb") as fh:
			files = {
				"file": (os.path.basename(local_path), fh, content_type),
				"metadata": (None, json.dumps(metadata), "application/json; charset=UTF-8"),
			}
			r = requests.post(url, headers=headers, files=files, timeout=120)
		if r.status_code not in (200, 201):
			raise RuntimeError(f"Upload failed: {r.status_code} {r.text}")

		return f"https://firebasestorage.googleapis.com/v0/b/{self.storage_bucket}/o/{quote(dest_path, safe='')}?alt=media&token={token}"

	# ---------- Helpers ----------
	def _from_firestore_document(self, doc_json: Dict[str, Any]) -> Dict[str, Any]:
		name = doc_json.get("name", "")
		doc_id = name.split("/")[-1] if name else ""
		fields = doc_json.get("fields", {})
		return {"id": doc_id, "fields": from_firestore_fields(fields), "_raw": doc_json}


# ---------- Firestore value conversion ----------
def to_firestore_value(value: Any) -> Dict[str, Any]:
	if value is None:
		return {"nullValue": None}
	if isinstance(value, bool):
		return {"booleanValue": value}
	if isinstance(value, int) and not isinstance(value, bool):
		return {"integerValue": str(value)}
	if isinstance(value, float):
		return {"doubleValue": value}
	if isinstance(value, str):
		return {"stringValue": value}
	if isinstance(value, dict):
		return {"mapValue": {"fields": to_firestore_fields(value)}}
	if isinstance(value, list):
		return {"arrayValue": {"values": [to_firestore_value(v) for v in value]}}
	return {"stringValue": str(value)}


def to_firestore_fields(d: Dict[str, Any]) -> Dict[str, Any]:
	return {k: to_firestore_value(v) for k, v in d.items()}


def from_firestore_value(obj: Dict[str, Any]) -> Any:
	if "nullValue" in obj:
		return None
	if "booleanValue" in obj:
		return bool(obj["booleanValue"])
	if "integerValue" in obj:
		try:
			return int(obj["integerValue"])
		except Exception:
			return obj["integerValue"]
	if "doubleValue" in obj:
		return float(obj["doubleValue"])
	if "stringValue" in obj:
		return obj["stringValue"]
	if "mapValue" in obj:
		return from_firestore_fields(obj["mapValue"].get("fields", {}))
	if "arrayValue" in obj:
		values = obj["arrayValue"].get("values", [])
		return [from_firestore_value(v) for v in values]
	if "timestampValue" in obj:
		return obj["timestampValue"]
	return obj


def from_firestore_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
	return {k: from_firestore_value(v) for k, v in fields.items()}


def flatten_field_paths(d: Dict[str, Any], prefix: str = "") -> List[str]:
	paths: List[str] = []
	for k, v in d.items():
		current = f"{prefix}.{k}" if prefix else k
		if isinstance(v, dict) and v:
			paths.extend(flatten_field_paths(v, current))
		else:
			paths.append(current)
	return paths


# -------------------- UI --------------------
class JsonCollectionEditor(ttk.Frame):
	def __init__(self, master, fb: FirebaseClient, collection: str, allow_upload: bool = False):
		super().__init__(master)
		self.fb = fb
		self.collection = collection
		self.allow_upload = allow_upload
		self.docs: List[Dict[str, Any]] = []
		self.current_id: str | None = None

		self.columnconfigure(1, weight=1)
		self.rowconfigure(1, weight=1)

		# Header
		hdr = ttk.Frame(self)
		hdr.grid(row=0, column=0, columnspan=3, sticky="ew", padx=6, pady=6)
		hdr.columnconfigure(6, weight=1)
		ttk.Label(hdr, text=f"{collection}", font=("Segoe UI", 12, "bold")).grid(row=0, column=0, sticky="w")
		ttk.Button(hdr, text="Refresh", command=self.refresh).grid(row=0, column=1, padx=4)
		ttk.Button(hdr, text="New Doc", command=self.new_doc).grid(row=0, column=2, padx=4)
		ttk.Button(hdr, text="Delete", command=self.delete_doc).grid(row=0, column=3, padx=4)
		ttk.Button(hdr, text="Save", command=self.save_doc).grid(row=0, column=4, padx=4)
		if self.allow_upload:
			ttk.Button(hdr, text="Upload Image", command=self.upload_image).grid(row=0, column=5, padx=4)

		# List of docs
		left = ttk.Frame(self)
		left.grid(row=1, column=0, sticky="nsw", padx=6, pady=6)
		left.rowconfigure(1, weight=1)
		ttk.Label(left, text="Documents").grid(row=0, column=0, sticky="w")
		self.listbox = tk.Listbox(left, height=18, width=28)
		self.listbox.grid(row=1, column=0, sticky="nsw")
		self.listbox.bind("<<ListboxSelect>>", self.on_select)

		# JSON editor
		right = ttk.Frame(self)
		right.grid(row=1, column=1, sticky="nsew", padx=6, pady=6)
		right.rowconfigure(3, weight=1)
		right.columnconfigure(0, weight=1)

		ttk.Label(right, text="Document ID:").grid(row=0, column=0, sticky="w")
		self.doc_id_var = tk.StringVar()
		ttk.Entry(right, textvariable=self.doc_id_var).grid(row=0, column=1, sticky="ew")

		ttk.Label(right, text="JSON Fields").grid(row=1, column=0, sticky="w", pady=(6, 0))
		self.text = tk.Text(right, wrap="none", height=22, font=("Consolas", 10))
		self.text.grid(row=3, column=0, columnspan=2, sticky="nsew")

		# Scrollbars
		yscroll = ttk.Scrollbar(right, orient="vertical", command=self.text.yview)
		yscroll.grid(row=3, column=2, sticky="ns")
		xscroll = ttk.Scrollbar(right, orient="horizontal", command=self.text.xview)
		xscroll.grid(row=4, column=0, columnspan=2, sticky="ew")
		self.text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)

		self.refresh()

	def refresh(self) -> None:
		try:
			self.docs = self.fb.list_documents(self.collection)
			self.listbox.delete(0, tk.END)
			for d in self.docs:
				self.listbox.insert(tk.END, d["id"])
		except Exception as e:
			messagebox.showerror("Error", str(e))

	def on_select(self, _evt) -> None:
		sel = self.listbox.curselection()
		if not sel:
			return
		idx = sel[0]
		doc = self.docs[idx]
		self.current_id = doc["id"]
		self.doc_id_var.set(self.current_id)
		self.text.delete("1.0", tk.END)
		self.text.insert("1.0", json.dumps(doc["fields"], indent=2))

	def new_doc(self) -> None:
		self.current_id = ""
		self.doc_id_var.set("")
		self.text.delete("1.0", tk.END)
		self.text.insert("1.0", json.dumps({"title": "", "body": ""}, indent=2))

	def delete_doc(self) -> None:
		doc_id = self.doc_id_var.get().strip()
		if not doc_id:
			messagebox.showwarning("Delete", "No document ID.")
			return
		if not messagebox.askyesno("Delete", f"Delete '{doc_id}'?"):
			return
		try:
			self.fb.delete_document(self.collection, doc_id)
			self.refresh()
			self.new_doc()
		except Exception as e:
			messagebox.showerror("Error", str(e))

	def save_doc(self) -> None:
		doc_id = self.doc_id_var.get().strip()
		if not doc_id:
			messagebox.showwarning("Save", "Enter a document ID.")
			return
		try:
			content = json.loads(self.text.get("1.0", tk.END).strip() or "{}")
		except json.JSONDecodeError as e:
			messagebox.showerror("JSON Error", f"Invalid JSON: {e}")
			return

		try:
			exists = self.fb.get_document(self.collection, doc_id)
			if exists:
				self.fb.update_document(self.collection, doc_id, content)
			else:
				self.fb.create_document(self.collection, doc_id, content)
			self.refresh()
			messagebox.showinfo("Saved", "Document saved.")
		except Exception as e:
			messagebox.showerror("Error", str(e))

	def upload_image(self) -> None:
		if not self.allow_upload:
			return
		path = filedialog.askopenfilename(
			title="Select image",
			filetypes=[
				("Images", "*.jpg;*.jpeg;*.png;*.webp;*.bmp"),
				("All Files", "*.*"),
			],
		)
		if not path:
			return

		default_name = os.path.basename(path)
		dest_path = simple_prompt(self, "Storage path", f"sliderImages/{default_name}")
		if not dest_path:
			return

		# Optional compression if Pillow is available
		upload_path = path
		content_type = None
		temp_file = None
		if Image is not None:
			try:
				img = Image.open(path).convert("RGB")
				max_dim = 1920
				w, h = img.size
				if max(w, h) > max_dim:
					if w >= h:
						nw, nh = max_dim, int(h * (max_dim / w))
					else:
						nw, nh = int(w * (max_dim / h)), max_dim
					img = img.resize((nw, nh), Image.LANCZOS)
				temp_file = os.path.join(os.path.dirname(path), f"__tmp__{uuid.uuid4().hex}.jpg")
				img.save(temp_file, format="JPEG", quality=85, optimize=True)
				upload_path = temp_file
				content_type = "image/jpeg"
			except Exception:
				upload_path = path
				content_type = None

		try:
			url = self.fb.upload_file(upload_path, dest_path, content_type=content_type)
			# Merge URL into current JSON under 'imageUrl'
			try:
				content = json.loads(self.text.get("1.0", tk.END).strip() or "{}")
			except Exception:
				content = {}
			content["imageUrl"] = url
			self.text.delete("1.0", tk.END)
			self.text.insert("1.0", json.dumps(content, indent=2))
			messagebox.showinfo("Upload", "Image uploaded. URL inserted as 'imageUrl'. Click Save to persist.")
		except Exception as e:
			messagebox.showerror("Upload Error", str(e))
		finally:
			if temp_file and os.path.exists(temp_file):
				try:
					os.remove(temp_file)
				except Exception:
					pass


def simple_prompt(parent, title: str, initial_value: str = "") -> str | None:
	dlg = tk.Toplevel(parent)
	dlg.title(title)
	dlg.transient(parent)
	dlg.grab_set()
	v = tk.StringVar(value=initial_value)
	ttk.Label(dlg, text=title).grid(row=0, column=0, padx=8, pady=8, sticky="w")
	e = ttk.Entry(dlg, textvariable=v, width=60)
	e.grid(row=1, column=0, padx=8, pady=4)
	e.focus_set()
	res: dict[str, str | None] = {"value": None}

	def ok() -> None:
		res["value"] = v.get()
		dlg.destroy()

	def cancel() -> None:
		dlg.destroy()

	btns = ttk.Frame(dlg)
	btns.grid(row=2, column=0, padx=8, pady=8, sticky="e")
	ttk.Button(btns, text="OK", command=ok).grid(row=0, column=0, padx=4)
	ttk.Button(btns, text="Cancel", command=cancel).grid(row=0, column=1, padx=4)
	dlg.wait_window()
	return res["value"]


class AdminApp(tk.Tk):
	def __init__(self):
		super().__init__()
		self.title("Cusumano Desktop Admin")
		self.geometry("1100x720")

		if not FIREBASE_API_KEY or not FIREBASE_PROJECT_ID or not FIREBASE_STORAGE_BUCKET:
			self.after(200, lambda: messagebox.showwarning(
				"Config",
				"Set FIREBASE_API_KEY, FIREBASE_PROJECT_ID, and FIREBASE_STORAGE_BUCKET as env vars or edit DesktopAdminPanel.py",
			))

		self.fb = FirebaseClient(FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET)

		# Login UI
		self.login_frame = ttk.Frame(self)
		self.login_frame.pack(fill="both", expand=True, padx=12, pady=12)

		ttk.Label(self.login_frame, text="Login", font=("Segoe UI", 14, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 8))

		ttk.Label(self.login_frame, text="Email").grid(row=1, column=0, sticky="e")
		self.email_var = tk.StringVar()
		ttk.Entry(self.login_frame, textvariable=self.email_var, width=40).grid(row=1, column=1, sticky="w")

		ttk.Label(self.login_frame, text="Password").grid(row=2, column=0, sticky="e", pady=(4, 0))
		self.pass_var = tk.StringVar()
		ttk.Entry(self.login_frame, textvariable=self.pass_var, show="*", width=40).grid(row=2, column=1, sticky="w", pady=(4, 0))

		self.login_status = ttk.Label(self.login_frame, text="", foreground="#555")
		self.login_status.grid(row=3, column=0, columnspan=2, sticky="w", pady=(6, 0))

		ttk.Button(self.login_frame, text="Sign In", command=self.sign_in).grid(row=4, column=1, sticky="e", pady=(10, 0))

		# Tabs (hidden until login)
		self.tabs = ttk.Notebook(self)

		# Collection editors
		self.editors: dict[str, JsonCollectionEditor] = {}
		for col in DEFAULT_COLLECTIONS:
			allow_upload = (col == "sliderImages")
			frame = JsonCollectionEditor(self.tabs, self.fb, col, allow_upload=allow_upload)
			self.tabs.add(frame, text=col)
			self.editors[col] = frame

		# Audit logs (read-only best-effort)
		self.audit_tab = ttk.Frame(self.tabs)
		self.tabs.add(self.audit_tab, text="auditLogs")
		self.audit_list = tk.Listbox(self.audit_tab)
		self.audit_list.pack(fill="both", expand=True, padx=8, pady=8)

		# Status bar
		self.status = tk.StringVar(value="Not signed in")
		self.status_bar = ttk.Label(self, textvariable=self.status, relief="sunken", anchor="w")
		self.status_bar.pack(fill="x", side="bottom")

	def sign_in(self) -> None:
		email = self.email_var.get().strip()
		password = self.pass_var.get().strip()
		if not email or not password:
			messagebox.showwarning("Login", "Enter email and password.")
			return
		self.login_status.config(text="Signing in...")
		self.update_idletasks()
		try:
			self.fb.sign_in(email, password)
			is_admin = self.fb.is_admin_claim()
			self.status.set(f"Signed in as {email} {'(admin)' if is_admin else ''}")
			# Switch to tabs
			self.login_frame.pack_forget()
			self.tabs.pack(fill="both", expand=True)
			# Load audit logs asynchronously
			threading.Thread(target=self._load_audit_logs, daemon=True).start()
		except Exception as e:
			self.login_status.config(text="")
			messagebox.showerror("Login failed", str(e))

	def _load_audit_logs(self) -> None:
		try:
			docs = self.fb.list_documents("auditLogs")
			self.audit_list.delete(0, tk.END)
			for d in sorted(docs, key=lambda x: x["id"])[:200]:
				self.audit_list.insert(tk.END, f"{d['id']}  {json.dumps(d['fields'])}")
		except Exception as e:
			# Ignore if not permitted
			self.audit_list.insert(tk.END, f"Cannot load auditLogs: {e}")


def main() -> None:
	app = AdminApp()
	app.mainloop()


if __name__ == "__main__":
	main()

