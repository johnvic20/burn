# BURN — 3D Cronos World

A React + Vite + Three.js landing page that turns the supplied BURN artwork into an immersive 2.5D/3D-style world.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Build

```bash
npm run build
npm run preview
```

## Cronos integration

The site includes a Cronos Mainnet wallet connection flow using `ethers`. The Connect button switches/adds Cronos Mainnet (chain ID 25 / `0x19`) and shows the connected address. The Buy buttons point to the configured Cronos Launch token URL.

The token address and buy URL are currently configured in `src/main.jsx`. For production, move those values into environment variables if the token changes.

## Design

The original image remains the visual hero. Three.js adds camera depth, subtle relief, floating 3D coins, embers, fire lighting, parallax, camera travel, and interactive world hotspots. This is intentionally a 2.5D approach: it preserves the supplied artwork instead of replacing it with generic 3D assets.
