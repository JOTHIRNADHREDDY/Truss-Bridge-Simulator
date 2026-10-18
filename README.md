# 🌉 3D Truss Bridge Simulator & Analyzer

An interactive, real-time 3D structural engineering simulator built with **React 19**, **Three.js**, **React Three Fiber**, **Tailwind CSS v4**, and **Zustand**. 

This application simulates and analyzes bridge structures in full 3D space using the **Direct Stiffness Method (DSM)** and finite element structural analysis. It features real-time dynamic stress visualization, deformation animation, progressive collapse simulation, stability diagnostics, and customizable structural materials.

---

## 🚀 Key Features

### 🏗️ 1. Interactive 3D CAD & Modeling (Build Mode)
* **Custom Node & Member Creation:** Place nodes anywhere in 3D space and connect them with structural members.
* **3D Transform Controls:** Manipulate nodes directly in the 3D viewport along X, Y, and Z axes.
* **Support Types:**
  * **Pin Support:** Fixes translation in $X, Y, Z$.
  * **Roller X:** Allows horizontal motion along $X$; restrains $Y, Z$.
  * **Roller Y:** Allows vertical motion along $Y$; restrains $X, Z$.
  * **Roller Z:** Restrains $X, Y$; allows out-of-plane $Z$ motion.
  * **Fixed Support:** Full rigid restraint.
* **3D Vector Load Application:** Apply concentrated point loads to any node with customizable magnitude ($\text{kN}$), in-plane angle ($XY$), and out-of-plane inclination ($Z$).
* **Smart Editing Tools:**
  * Multi-selection and box-selection.
  * Dynamic alignment guidelines for precise snapping.
  * Duplicate selection (`Ctrl+D` / `Cmd+D`).
  * Full Undo/Redo history stack (`Ctrl+Z` / `Ctrl+Y`).
  * Delete entities (`Delete` / `Backspace`).

---

### ⚙️ 2. Finite Element Analysis (FEA) Physics Solver
* **Direct Stiffness Method:** Assembles the global stiffness matrix $K_{global} \in \mathbb{R}^{3N \times 3N}$ from individual 3D truss element transformation matrices:
  $$k_e = \frac{EA}{L} \begin{bmatrix} T^T T & -T^T T \\ -T^T T & T^T T \end{bmatrix}$$
* **Nodal Displacements ($U$):** Solved via Gaussian elimination with partial pivoting ($K \cdot U = F$).
* **Axial Member Forces & Stresses:** Calculates exact tension and compression forces:
  $$F = \frac{EA}{L} \left( -c_x u_{ix} - c_y u_{iy} - c_z u_{iz} + c_x u_{jx} + c_y u_{jy} + c_z u_{jz} \right)$$
  $$\sigma = \frac{F}{A}$$
* **Support Reactions:** Automatically computes reaction forces at restrained degrees of freedom.
* **Statical Determinacy & Stability Diagnostics:**
  * Evaluates determinacy using Maxwell-Betti degree criteria ($m + r - 3j$):
    * **Unstable** ($< 0$)
    * **Statically Determinate** ($= 0$)
    * **Redundant / Indeterminate** ($> 0$)
  * Detects kinematic mechanisms, unbraced out-of-plane nodes, and singularity matrices.
* **Progressive Collapse & Fracture:** If member stress exceeds the material's yield strength ($\sigma > \sigma_y$), members can fail and break, dynamically redistributing forces through the remaining structure.

---

### 🌈 3. Dynamic Real-Time Stress Field Visualization
* **Normalized Live Color Gradient:** Dynamically maps member stresses normalized against maximum current system stress:
  * 🔵 **Very Low Stress:** Deep Blue (`#1e3a8a`)
  * 🩵 **Low Stress:** Cyan (`#06b6d4`)
  * 🟢 **Medium Stress:** Green (`#10b981`)
  * 🟡 **High Stress:** Yellow (`#eab308`)
  * 🟠 **Very High Stress:** Orange (`#f97316`)
  * 🔴 **Critical / Yielding:** Bright Red (`#ef4444`)
* **Flicker-Free Smooth Transitions:** Employs linear interpolation (`lerp`) across animation frames for smooth color shifts during load changes.
* **Pulsating High-Stress Warning:** Members approaching critical yield strength exhibit an animated emissive pulse.
* **Continuous Deformation Synchronization:** Visualizes realistic structural deflection with adjustable scale amplification ($1\times$ to $1000\times$) and controllable animation playback speed.
* **Load Highlight:** Active load-bearing nodes glow red with 3D force direction vectors and magnitude labels.

---

### 🏛️ 4. Parametric Bridge Presets
Instantly generate full 3D bridge designs with custom **Span Width** and **Height/Slope** sliders:
* **Warren Truss Bridge:** Equilateral/isosceles triangular web pattern with top and bottom chord lateral cross-bracing.
* **Pratt Truss Bridge:** Vertical members in compression and diagonals in tension under gravity load.
* **Howe Truss Bridge:** Diagonals in compression and verticals in tension.
* **K-Truss Bridge:** Subdivided vertical panels reducing buckling lengths, with dedicated 3D out-of-plane portal cross-bracing.
* **Bowstring Arch Truss:** Curved parabolic top arch with balanced tension bottom tie.
* **Suspension Bridge:** Complete suspension bridge with parabolic main cables, deck suspenders, stiffening diagonal trusses, and anchor towers.

---

### 🔬 5. Materials Library
Switch materials at runtime to analyze differing elastic moduli, cross-sectional areas, and yield limits:
| Material | Elastic Modulus ($E$) | Yield Strength ($\sigma_y$) | Density ($\rho$) | Area ($A$) |
| :--- | :--- | :--- | :--- | :--- |
| **Structural Steel** | $200\text{ GPa}$ | $250\text{ MPa}$ | $7850\text{ kg/m}^3$ | $0.01\text{ m}^2$ |
| **Structural Wood** | $11\text{ GPa}$ | $40\text{ MPa}$ | $600\text{ kg/m}^3$ | $0.04\text{ m}^2$ |
| **Structural Aluminum** | $69\text{ GPa}$ | $270\text{ MPa}$ | $2700\text{ kg/m}^3$ | $0.01\text{ m}^2$ |

---

### 📊 6. Analytics, Charts & Export
* **Stress Legend & Interactive Pointer:** Visual gradient legend displaying $0\text{ MPa}$, $\frac{1}{2} \text{Max}$, and $\text{Max Stress}$, with an indicator tracking the currently selected member.
* **Live Rolling Chart:** Real-time max stress vs. time graph powered by Chart.js.
* **Member Stress Distribution Bar Chart:** Per-member breakdown color-coded by stress intensity.
* **AI Structural Diagnostics:** Context-aware engineering recommendations (e.g. suggesting diagonal bracing, reinforcing weak members, or optimizing redundant elements).
* **Detailed Text Report:** Download a complete simulation report (`truss_report.txt`) with nodal summaries and member tension/compression classifications.
* **Save & Load JSON:** Export bridge projects to `.json` files and reload them anytime.
* **PNG Screenshot Export:** Capture clean high-resolution renders of the 3D scene.

---

## 🛠️ Tech Stack

* **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool:** [Vite 6](https://vitejs.dev/)
* **3D Graphics & WebGL:** [Three.js](https://threejs.org/) + [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/) + [@react-three/drei](https://github.com/pmndrs/drei)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **State Management:** [Zustand 5](https://github.com/pmndrs/zustand)
* **Charts & Graphing:** [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)
* **Icons:** [Lucide React](https://lucide.dev/)

---

## 📂 Project Structure

```
├── src/
│   ├── components/
│   │   ├── Canvas.tsx         # 3D R3F Viewport, OrbitControls, MemberMesh, NodeMesh, Load vectors
│   │   ├── LeftPanel.tsx      # Tool selection, mode toggle, materials, presets, view controls
│   │   └── RightPanel.tsx     # Determinacy analysis, live charts, stress legend, report generator
│   ├── lib/
│   │   ├── physics.ts         # Direct Stiffness Method (DSM) 3D FEA solver, matrix assembly, solver
│   │   └── presets.ts         # Parametric bridge generators (Warren, Pratt, Howe, K-Truss, Bowstring, Suspension)
│   ├── store/
│   │   └── useStore.ts        # Zustand store managing nodes, members, loads, history, tools, simulation state
│   ├── App.tsx                # Main layout and global keyboard shortcuts
│   ├── main.tsx               # React application entrypoint
│   └── index.css              # Global styles & Tailwind CSS imports
├── index.html                 # HTML shell
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite configuration
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` / `Cmd + Z` | Undo last action |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo action |
| `Ctrl + D` / `Cmd + D` | Duplicate selected nodes / members / loads |
| `Delete` / `Backspace` | Delete selected entities |
| `Shift + Click` | Multi-select entities |
| `Left Click + Drag` | Orbit 3D camera / Move nodes |
| `Right Click + Drag` | Pan 3D camera |
| `Scroll Wheel` | Zoom in / out |

---

## 💻 Getting Started Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (version 18 or higher recommended)
* `npm` or `pnpm` / `yarn`

### Installation
1. Clone the repository or navigate to the project directory:
   ```bash
   git clone <repo-url>
   cd <project-folder>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
```
This generates the optimized bundle in the `dist` folder. To preview the production build locally:
```bash
npm run preview
```

---

## 📜 License
Apache-2.0
