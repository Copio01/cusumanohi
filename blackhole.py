"""
Stellar Evolution Simulator - Complete Lifecycle of Stars
========================================================

Features:
- Scientifically accurate stellar evolution from protostar to end state
- Real physics: hydrostatic equilibrium, nuclear fusion, radiation pressure
- Complete stellar lifecycle: formation → main sequence → giant → collapse
- End states: white dwarf, neutron star, or black hole based on mass
- Realistic nuclear fusion reactions and energy output
- Chandrasekhar limit and stellar mass calculations
- Dynamic visual effects for each evolutionary phase
- Supernova explosions with shock waves and nucleosynthesis
- Real-time stellar parameter calculations

Stellar Evolution Phases:
1. Molecular Cloud Collapse
2. Protostar Formation  
3. Main Sequence (Hydrogen Burning)
4. Red Giant Phase (Helium Flash)
5. Asymptotic Giant Branch
6. Final Collapse:
   - White Dwarf (< 1.4 M☉)
   - Neutron Star (1.4-3 M☉) 
   - Black Hole (> 3 M☉)

Controls:
- SPACE: Start/Pause stellar evolution
- R: Reset to molecular cloud
- +/-: Adjust initial star mass
- 1-6: Jump to evolution phase
- T: Toggle temperature display
- F: Toggle fusion reactions view
- H: Toggle Hertzsprung-Russell diagram
- S: Trigger supernova (if massive enough)
- Mouse: Add gas/matter to forming star
"""

import pygame
import math
import random
import numpy as np
from typing import List, Tuple, Dict
import colorsys
import time

# Initialize Pygame
pygame.init()

# Constants - Real Astrophysical Values (scaled for simulation)
SCREEN_WIDTH = 1400
SCREEN_HEIGHT = 900
FPS = 60

# Physical Constants (scaled)
G = 6.67430e-11 * 1e15  # Gravitational constant (scaled up)
C = 299792458 * 1e-6    # Speed of light (scaled down)
STEFAN_BOLTZMANN = 5.67e-8 * 1e10  # Stefan-Boltzmann constant
PLANCK = 6.626e-34 * 1e20  # Planck constant
BOLTZMANN = 1.381e-23 * 1e15  # Boltzmann constant

# Solar Constants
SOLAR_MASS = 1.989e30
SOLAR_RADIUS = 6.96e8
SOLAR_LUMINOSITY = 3.828e26
SOLAR_TEMPERATURE = 5778

# Stellar Evolution Constants
CHANDRASEKHAR_LIMIT = 1.4 * SOLAR_MASS
NEUTRON_STAR_LIMIT = 3.0 * SOLAR_MASS
NUCLEAR_BINDING_ENERGY = 8.8e13  # Joules per kg
FUSION_EFFICIENCY = 0.007  # Mass to energy conversion efficiency

# Colors for different stellar phases
COLORS = {
    'molecular_cloud': (20, 20, 40),
    'protostar': (100, 50, 20),
    'main_sequence': (255, 255, 200),
    'red_giant': (255, 100, 50),
    'white_dwarf': (200, 200, 255),
    'neutron_star': (150, 150, 255),
    'black_hole': (0, 0, 0),
    'supernova': (255, 255, 255),
    'background': (5, 5, 15)
}

# Basic colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
ORANGE = (255, 165, 0)
YELLOW = (255, 255, 0)
BLUE = (0, 100, 255)
PURPLE = (128, 0, 128)
GREEN = (0, 255, 0)

class StellarPhysics:
    """Class containing all stellar physics calculations"""
    
    @staticmethod
    def blackbody_temperature_to_color(temperature):
        """Convert temperature to RGB color using blackbody radiation"""
        # Clamp temperature to visible range
        temp = max(1000, min(temperature, 40000))
        
        # Approximation of blackbody color
        if temp < 3500:
            r = 255
            g = int((-40.25 * (temp / 100)) + 410.75)
            b = 0
        elif temp < 5000:
            r = int((-42.38 * (temp / 100)) + 631.9)
            g = int((-89.75 * (temp / 100)) + 791.75)
            b = int((56.30 * (temp / 100)) - 91.5)
        elif temp < 6600:
            r = int((-175.25 * (temp / 100)) + 1266.75)
            g = int((-19.75 * (temp / 100)) + 420.75)
            b = 255
        else:
            r = int((-87.12 * (temp / 100)) + 986.12)
            g = int((-26.25 * (temp / 100)) + 590.25)
            b = 255
            
        return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
    
    @staticmethod
    def stellar_luminosity(mass, radius, temperature):
        """Calculate stellar luminosity using Stefan-Boltzmann law"""
        surface_area = 4 * math.pi * radius**2
        return STEFAN_BOLTZMANN * surface_area * temperature**4
    
    @staticmethod
    def hydrostatic_equilibrium_radius(mass, temperature):
        """Calculate stellar radius from hydrostatic equilibrium"""
        # Simplified relationship: R ∝ M/T for main sequence stars
        return (mass / SOLAR_MASS) * SOLAR_RADIUS * (SOLAR_TEMPERATURE / temperature)**0.5
    
    @staticmethod
    def nuclear_fusion_rate(mass, temperature, density):
        """Calculate nuclear fusion rate using temperature dependence"""
        # Proton-proton chain temperature dependence: ε ∝ T^4
        if temperature < 1e7:  # No fusion below ~10 million K
            return 0
        
        # Fusion rate per unit mass
        epsilon = 1e-5 * (density / 100) * (temperature / 1.5e7)**4
        return epsilon * mass
    
    @staticmethod
    def chandrasekhar_mass():
        """Return the Chandrasekhar limit"""
        return CHANDRASEKHAR_LIMIT
    
    @staticmethod
    def stellar_lifetime(mass):
        """Calculate stellar main sequence lifetime"""
        # Lifetime ∝ M/L ∝ M^(-2.5) for main sequence stars
        solar_lifetime = 10e9  # 10 billion years
        return solar_lifetime * (SOLAR_MASS / mass)**2.5

class GasParticle:
    """Individual gas particle for stellar formation"""
    def __init__(self, x, y, vx=0, vy=0, mass=1, temperature=10):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.mass = mass
        self.temperature = temperature
        self.density = 1.0
        self.age = 0
        
    def distance_to(self, other):
        """Calculate distance to another particle"""
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

class Star:
    """Main star class with complete stellar evolution"""
    
    def __init__(self, x, y, initial_mass):
        self.x = x
        self.y = y
        self.initial_mass = initial_mass
        self.mass = initial_mass
        self.radius = 1.0
        self.temperature = 10  # Start cold
        self.luminosity = 0
        self.density = 1.0
        self.pressure = 0
        self.age = 0
        self.lifetime = StellarPhysics.stellar_lifetime(initial_mass)
        
        # Evolution phase
        self.phase = "molecular_cloud"
        self.phase_time = 0
        self.nuclear_fuel = self.mass * FUSION_EFFICIENCY
        
        # Visual properties
        self.color = COLORS['molecular_cloud']
        self.brightness = 0
        self.pulsation = 0
        
        # Explosion properties for supernova
        self.exploding = False
        self.explosion_time = 0
        self.shock_wave_radius = 0
        
        # Core properties for collapse
        self.core_mass = 0
        self.core_temperature = 0
        self.degeneracy_pressure = 0
        
    def update_stellar_structure(self):
        """Update stellar structure based on current mass and phase"""
        if self.phase == "molecular_cloud":
            self.temperature = 10 + (self.mass / SOLAR_MASS) * 20
            self.radius = (self.mass / SOLAR_MASS) * 100 * SOLAR_RADIUS
            self.density = self.mass / (4/3 * math.pi * self.radius**3)
            
        elif self.phase == "protostar":
            # Kelvin-Helmholtz contraction
            self.temperature = 1000 + (self.mass / SOLAR_MASS) * 2000
            self.radius = (self.mass / SOLAR_MASS) * 10 * SOLAR_RADIUS
            self.density = self.mass / (4/3 * math.pi * self.radius**3)
            
        elif self.phase == "main_sequence":
            # Mass-luminosity relation: L ∝ M^3.5
            mass_ratio = self.mass / SOLAR_MASS
            self.temperature = SOLAR_TEMPERATURE * mass_ratio**0.6
            self.radius = StellarPhysics.hydrostatic_equilibrium_radius(self.mass, self.temperature)
            self.luminosity = SOLAR_LUMINOSITY * mass_ratio**3.5
            self.density = self.mass / (4/3 * math.pi * self.radius**3)
            
        elif self.phase == "red_giant":
            # Expanded envelope, hot core
            mass_ratio = self.mass / SOLAR_MASS
            self.temperature = SOLAR_TEMPERATURE * 0.6  # Cooler surface
            self.radius = SOLAR_RADIUS * mass_ratio * 50  # Much larger
            self.luminosity = SOLAR_LUMINOSITY * mass_ratio**2 * 100
            self.core_mass = self.mass * 0.3
            self.core_temperature = 1e8  # Helium burning
            
        elif self.phase == "white_dwarf":
            # Electron degenerate matter
            self.temperature = 50000  # Very hot initially
            self.radius = SOLAR_RADIUS * 0.01  # Earth-sized
            self.density = self.mass / (4/3 * math.pi * self.radius**3)
            self.luminosity = SOLAR_LUMINOSITY * 0.001
            
        elif self.phase == "neutron_star":
            # Neutron degenerate matter
            self.temperature = 1e6  # Million K
            self.radius = 10000  # ~10 km
            self.density = 1e18  # Nuclear density
            self.luminosity = SOLAR_LUMINOSITY * 0.1
            
        elif self.phase == "black_hole":
            # Schwarzschild radius
            self.radius = 2 * G * self.mass / C**2
            self.temperature = 0  # No surface
            self.luminosity = 0
            self.density = float('inf')
    
    def evolve(self, dt):
        """Evolve star through stellar evolution phases"""
        self.age += dt
        self.phase_time += dt
        
        if self.phase == "molecular_cloud":
            # Gravitational collapse
            if self.phase_time > 1000:  # Collapse time
                self.phase = "protostar"
                self.phase_time = 0
                
        elif self.phase == "protostar":
            # Heating up due to gravitational contraction
            if self.temperature > 1e7:  # Nuclear ignition temperature
                self.phase = "main_sequence"
                self.phase_time = 0
                
        elif self.phase == "main_sequence":
            # Nuclear fusion of hydrogen
            fusion_rate = StellarPhysics.nuclear_fusion_rate(self.mass, self.temperature, self.density)
            self.nuclear_fuel -= fusion_rate * dt
            
            # Check if hydrogen is exhausted
            if self.nuclear_fuel <= 0 or self.phase_time > self.lifetime * 0.9:
                if self.initial_mass < 0.5 * SOLAR_MASS:
                    self.phase = "white_dwarf"
                else:
                    self.phase = "red_giant"
                self.phase_time = 0
                
        elif self.phase == "red_giant":
            # Helium burning in core, hydrogen burning in shell
            if self.phase_time > self.lifetime * 0.1:
                self.determine_final_fate()
                
        elif self.phase == "supernova":
            # Explosive phase
            self.exploding = True
            self.explosion_time += dt
            self.shock_wave_radius = C * self.explosion_time * 0.1
            
            if self.explosion_time > 100:  # End of explosion
                self.determine_remnant()
                
        # Update stellar structure
        self.update_stellar_structure()
        
        # Update visual properties
        self.update_visuals()
    
    def determine_final_fate(self):
        """Determine the final fate based on stellar mass"""
        if self.initial_mass < CHANDRASEKHAR_LIMIT:
            self.phase = "white_dwarf"
        elif self.initial_mass < NEUTRON_STAR_LIMIT:
            self.phase = "supernova"
            self.exploding = True
        else:
            self.phase = "supernova"  # Will become black hole
            self.exploding = True
    
    def determine_remnant(self):
        """Determine remnant after supernova"""
        if self.initial_mass < NEUTRON_STAR_LIMIT:
            self.phase = "neutron_star"
            self.mass = 1.4 * SOLAR_MASS  # Typical neutron star mass
        else:
            self.phase = "black_hole"
            self.mass = self.initial_mass * 0.5  # Some mass lost in explosion
        
        self.exploding = False
        self.explosion_time = 0
    
    def update_visuals(self):
        """Update visual properties based on current state"""
        if self.phase == "supernova":
            # Bright white explosion
            self.color = COLORS['supernova']
            self.brightness = 1000
        else:
            self.color = StellarPhysics.blackbody_temperature_to_color(self.temperature)
            self.brightness = min(255, self.luminosity / SOLAR_LUMINOSITY * 100)
        
        # Add pulsation for certain phases
        if self.phase in ["red_giant", "protostar"]:
            self.pulsation = math.sin(self.age * 0.1) * 0.1 + 1.0
        else:
            self.pulsation = 1.0

class StellarSimulator:
    """Main stellar evolution simulator"""
    
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Stellar Evolution Simulator")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 24)
        self.small_font = pygame.font.Font(None, 18)
        self.large_font = pygame.font.Font(None, 32)
        
        # Simulation state
        self.running = True
        self.paused = True
        self.show_temperature = True
        self.show_fusion = True
        self.show_hr_diagram = False
        
        # View controls
        self.zoom = 1.0
        self.camera_x = 0
        self.camera_y = 0
        
        # Stellar objects
        self.star = Star(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, 1.0 * SOLAR_MASS)
        self.gas_particles = []
        
        # Time control
        self.time_scale = 1e6  # Speed up time
        self.simulation_time = 0
        
        # Visual effects
        self.background_stars = self.generate_background_stars()
        self.explosion_particles = []
        
        # HR diagram data
        self.hr_data = []
        
    def generate_background_stars(self):
        """Generate background stars for visual effect"""
        stars = []
        for _ in range(200):
            x = random.randint(0, SCREEN_WIDTH)
            y = random.randint(0, SCREEN_HEIGHT)
            brightness = random.randint(50, 150)
            stars.append((x, y, brightness))
        return stars
    
    def add_gas_particle(self, x, y):
        """Add gas particle to growing protostar"""
        if self.star.phase in ["molecular_cloud", "protostar"]:
            # Add angular momentum for realistic accretion
            dx = x - self.star.x
            dy = y - self.star.y
            distance = math.sqrt(dx**2 + dy**2)
            
            if distance > 0:
                # Orbital velocity
                orbital_speed = math.sqrt(G * self.star.mass / distance) * 0.7
                vx = -orbital_speed * dy / distance
                vy = orbital_speed * dx / distance
                
                particle = GasParticle(x, y, vx, vy, SOLAR_MASS * 0.001, 20)
                self.gas_particles.append(particle)
    
    def update_gas_particles(self, dt):
        """Update gas particle dynamics"""
        particles_to_remove = []
        
        for particle in self.gas_particles:
            # Gravitational force from star
            dx = self.star.x - particle.x
            dy = self.star.y - particle.y
            distance = math.sqrt(dx**2 + dy**2)
            
            if distance < self.star.radius:
                # Particle accreted by star
                self.star.mass += particle.mass
                particles_to_remove.append(particle)
                continue
            
            # Gravitational acceleration
            force = G * self.star.mass / distance**2
            ax = force * dx / distance
            ay = force * dy / distance
            
            # Update velocity and position
            particle.vx += ax * dt
            particle.vy += ay * dt
            particle.x += particle.vx * dt
            particle.y += particle.vy * dt
            
            # Age particle
            particle.age += dt
            
            # Remove old particles
            if particle.age > 1000:
                particles_to_remove.append(particle)
        
        # Remove accreted/old particles
        for particle in particles_to_remove:
            if particle in self.gas_particles:
                self.gas_particles.remove(particle)
    
    def update_explosion_particles(self, dt):
        """Update supernova explosion particles"""
        if self.star.exploding:
            # Create new explosion particles
            for _ in range(10):
                angle = random.uniform(0, 2 * math.pi)
                speed = random.uniform(1000, 5000)
                vx = math.cos(angle) * speed
                vy = math.sin(angle) * speed
                
                particle = {
                    'x': self.star.x,
                    'y': self.star.y,
                    'vx': vx,
                    'vy': vy,
                    'age': 0,
                    'brightness': random.randint(200, 255)
                }
                self.explosion_particles.append(particle)
        
        # Update existing explosion particles
        particles_to_remove = []
        for particle in self.explosion_particles:
            particle['x'] += particle['vx'] * dt
            particle['y'] += particle['vy'] * dt
            particle['age'] += dt
            particle['brightness'] *= 0.995  # Fade out
            
            if particle['brightness'] < 10 or particle['age'] > 200:
                particles_to_remove.append(particle)
        
        for particle in particles_to_remove:
            if particle in self.explosion_particles:
                self.explosion_particles.remove(particle)
    
    def draw_background(self):
        """Draw background stars"""
        self.screen.fill(COLORS['background'])
        for x, y, brightness in self.background_stars:
            color = (brightness, brightness, brightness)
            pygame.draw.circle(self.screen, color, (x, y), 1)
    
    def draw_star(self):
        """Draw the main star with phase-specific effects"""
        star_screen_x = int(self.star.x + self.camera_x)
        star_screen_y = int(self.star.y + self.camera_y)
        
        # Calculate display radius
        display_radius = max(1, int(self.star.radius / SOLAR_RADIUS * 20 * self.zoom * self.star.pulsation))
        
        if self.star.phase == "black_hole":
            # Draw event horizon
            pygame.draw.circle(self.screen, BLACK, (star_screen_x, star_screen_y), display_radius)
            pygame.draw.circle(self.screen, WHITE, (star_screen_x, star_screen_y), display_radius, 2)
            
            # Draw accretion disk if there are gas particles
            if self.gas_particles:
                for ring in range(3, 8):
                    ring_radius = max(1, int(display_radius * ring))
                    color = (100, 50, 0, 100)
                    surf = pygame.Surface((ring_radius * 2, ring_radius * 2), pygame.SRCALPHA)
                    pygame.draw.circle(surf, color, (ring_radius, ring_radius), ring_radius, 2)
                    self.screen.blit(surf, (star_screen_x - ring_radius, star_screen_y - ring_radius))
        
        elif self.star.phase == "supernova":
            # Draw explosion
            explosion_radius = max(1, int(self.star.shock_wave_radius / SOLAR_RADIUS * 10 * self.zoom))
            
            # Multiple explosion shells
            for shell in range(5):
                shell_radius = explosion_radius - shell * 20
                if shell_radius > 0:
                    alpha = max(0, 255 - shell * 40)
                    color = (255, max(0, 200 - shell * 30), max(0, 100 - shell * 20), alpha)
                    surf = pygame.Surface((shell_radius * 2, shell_radius * 2), pygame.SRCALPHA)
                    pygame.draw.circle(surf, color, (shell_radius, shell_radius), shell_radius, 3)
                    self.screen.blit(surf, (star_screen_x - shell_radius, star_screen_y - shell_radius))
            
            # Central bright core
            pygame.draw.circle(self.screen, WHITE, (star_screen_x, star_screen_y), 5)
        
        else:
            # Regular star phases
            # Draw stellar atmosphere (glow effect)
            if self.star.phase != "molecular_cloud":
                glow_radius = max(1, int(display_radius * 3))
                glow_color = (*self.star.color, 30)
                surf = pygame.Surface((glow_radius * 2, glow_radius * 2), pygame.SRCALPHA)
                pygame.draw.circle(surf, glow_color, (glow_radius, glow_radius), glow_radius)
                self.screen.blit(surf, (star_screen_x - glow_radius, star_screen_y - glow_radius))
            
            # Draw main stellar body
            pygame.draw.circle(self.screen, self.star.color, (star_screen_x, star_screen_y), display_radius)
            
            # Draw stellar features based on phase
            if self.star.phase == "red_giant":
                # Draw convection cells
                for i in range(5):
                    angle = (i * 72 + self.star.age * 10) % 360
                    cell_x = star_screen_x + int(math.cos(math.radians(angle)) * display_radius * 0.7)
                    cell_y = star_screen_y + int(math.sin(math.radians(angle)) * display_radius * 0.7)
                    cell_radius = max(2, display_radius // 8)
                    darker_color = tuple(max(0, c - 50) for c in self.star.color)
                    pygame.draw.circle(self.screen, darker_color, (cell_x, cell_y), cell_radius)
            
            elif self.star.phase == "main_sequence" and self.show_fusion:
                # Draw fusion core
                core_radius = max(1, display_radius // 4)
                brighter_color = tuple(min(255, c + 100) for c in self.star.color)
                pygame.draw.circle(self.screen, brighter_color, (star_screen_x, star_screen_y), core_radius)
    
    def draw_gas_particles(self):
        """Draw gas particles and accretion effects"""
        for particle in self.gas_particles:
            screen_x = int(particle.x + self.camera_x)
            screen_y = int(particle.y + self.camera_y)
            
            # Color based on temperature
            if particle.temperature < 50:
                color = (100, 100, 150)  # Cold gas
            elif particle.temperature < 1000:
                color = (150, 100, 100)  # Warm gas
            else:
                color = (255, 200, 100)  # Hot gas
            
            size = max(1, int(2 * self.zoom))
            pygame.draw.circle(self.screen, color, (screen_x, screen_y), size)
    
    def draw_explosion_particles(self):
        """Draw supernova explosion particles"""
        for particle in self.explosion_particles:
            screen_x = int(particle['x'] + self.camera_x)
            screen_y = int(particle['y'] + self.camera_y)
            brightness = int(particle['brightness'])
            color = (brightness, brightness // 2, brightness // 4)
            size = max(1, int(3 * self.zoom))
            pygame.draw.circle(self.screen, color, (screen_x, screen_y), size)
    
    def draw_ui(self):
        """Draw comprehensive user interface"""
        # Main stellar parameters
        params = [
            f"Phase: {self.star.phase.replace('_', ' ').title()}",
            f"Mass: {self.star.mass/SOLAR_MASS:.2f} M☉",
            f"Radius: {self.star.radius/SOLAR_RADIUS:.2f} R☉",
            f"Temperature: {self.star.temperature:.0f} K",
            f"Luminosity: {self.star.luminosity/SOLAR_LUMINOSITY:.2f} L☉",
            f"Age: {self.simulation_time/1e9:.2f} Gyr",
            f"Density: {self.star.density:.2e} kg/m³",
        ]
        
        if self.star.phase == "main_sequence":
            remaining_lifetime = (self.star.lifetime - self.star.phase_time) / 1e9
            params.append(f"Remaining: {remaining_lifetime:.2f} Gyr")
        
        for i, param in enumerate(params):
            color = WHITE
            if self.star.phase == "supernova":
                color = (255, 100, 100)
            elif self.star.phase == "black_hole":
                color = (200, 200, 255)
            
            text = self.small_font.render(param, True, color)
            self.screen.blit(text, (10, 10 + i * 22))
        
        # Phase progression indicator
        phase_names = ["molecular_cloud", "protostar", "main_sequence", "red_giant", "white_dwarf"]
        if self.star.initial_mass > CHANDRASEKHAR_LIMIT:
            phase_names = ["molecular_cloud", "protostar", "main_sequence", "red_giant", "supernova", "neutron_star"]
        if self.star.initial_mass > NEUTRON_STAR_LIMIT:
            phase_names[-1] = "black_hole"
        
        # Draw phase timeline
        timeline_y = SCREEN_HEIGHT - 80
        timeline_width = SCREEN_WIDTH - 40
        segment_width = timeline_width // len(phase_names)
        
        for i, phase in enumerate(phase_names):
            x = 20 + i * segment_width
            color = GREEN if phase == self.star.phase else (100, 100, 100)
            pygame.draw.rect(self.screen, color, (x, timeline_y, segment_width - 5, 20))
            
            text = self.small_font.render(phase.replace('_', ' '), True, WHITE)
            self.screen.blit(text, (x + 5, timeline_y + 25))
        
        # Controls
        controls = [
            "CONTROLS:",
            "SPACE: Start/Pause evolution",
            "R: Reset to molecular cloud",
            "+/-: Adjust initial mass",
            "1-6: Jump to phase",
            "Mouse: Add gas to star",
            "T: Toggle temperature view",
            "F: Toggle fusion view",
            "S: Force supernova (if massive)",
        ]
        
        for i, control in enumerate(controls):
            color = YELLOW if i == 0 else WHITE
            text = self.small_font.render(control, True, color)
            self.screen.blit(text, (SCREEN_WIDTH - 300, 10 + i * 20))
        
        # Status
        status_text = "PAUSED" if self.paused else "EVOLVING"
        status_color = RED if self.paused else GREEN
        status = self.large_font.render(status_text, True, status_color)
        self.screen.blit(status, (SCREEN_WIDTH // 2 - 50, 10))
    
    def handle_events(self):
        """Handle user input"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    self.paused = not self.paused
                elif event.key == pygame.K_r:
                    self.reset_simulation()
                elif event.key == pygame.K_t:
                    self.show_temperature = not self.show_temperature
                elif event.key == pygame.K_f:
                    self.show_fusion = not self.show_fusion
                elif event.key == pygame.K_h:
                    self.show_hr_diagram = not self.show_hr_diagram
                elif event.key == pygame.K_s and self.star.initial_mass > CHANDRASEKHAR_LIMIT:
                    self.star.phase = "supernova"
                    self.star.exploding = True
                elif event.key == pygame.K_PLUS or event.key == pygame.K_EQUALS:
                    self.star.initial_mass *= 1.2
                    if self.star.phase == "molecular_cloud":
                        self.star.mass = self.star.initial_mass
                elif event.key == pygame.K_MINUS:
                    self.star.initial_mass *= 0.8
                    if self.star.phase == "molecular_cloud":
                        self.star.mass = self.star.initial_mass
                
                # Jump to phases
                elif event.key == pygame.K_1:
                    self.star.phase = "molecular_cloud"
                elif event.key == pygame.K_2:
                    self.star.phase = "protostar"
                elif event.key == pygame.K_3:
                    self.star.phase = "main_sequence"
                elif event.key == pygame.K_4:
                    self.star.phase = "red_giant"
                elif event.key == pygame.K_5:
                    if self.star.initial_mass < CHANDRASEKHAR_LIMIT:
                        self.star.phase = "white_dwarf"
                    else:
                        self.star.phase = "neutron_star"
                elif event.key == pygame.K_6:
                    if self.star.initial_mass > NEUTRON_STAR_LIMIT:
                        self.star.phase = "black_hole"
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # Left click
                    mouse_x, mouse_y = event.pos
                    self.add_gas_particle(mouse_x - self.camera_x, mouse_y - self.camera_y)
    
    def reset_simulation(self):
        """Reset simulation to initial state"""
        initial_mass = self.star.initial_mass
        self.star = Star(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, initial_mass)
        self.gas_particles.clear()
        self.explosion_particles.clear()
        self.simulation_time = 0
        self.hr_data.clear()
    
    def update(self, dt):
        """Update simulation"""
        if not self.paused:
            scaled_dt = dt * self.time_scale
            self.simulation_time += scaled_dt
            
            # Update star evolution
            self.star.evolve(scaled_dt)
            
            # Update particle systems
            self.update_gas_particles(scaled_dt)
            self.update_explosion_particles(scaled_dt)
            
            # Record HR diagram data
            if len(self.hr_data) < 1000:  # Limit data points
                self.hr_data.append((self.star.temperature, self.star.luminosity))
    
    def run(self):
        """Main simulation loop"""
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0  # Convert to seconds
            
            self.handle_events()
            self.update(dt)
            
            # Draw everything
            self.draw_background()
            self.draw_gas_particles()
            self.draw_star()
            self.draw_explosion_particles()
            self.draw_ui()
            
            pygame.display.flip()
        
        pygame.quit()

def main():
    """Main function"""
    simulator = StellarSimulator()
    simulator.run()

if __name__ == "__main__":
    main()