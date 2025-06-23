# clayable

sculpt 3d clay in your browser 

## what it does

interactive clay sculpting using threejs and real-time vertex manipulation. pick a tool, pick a color, and start sculpting. works on desktop and mobile with touch controls.

## features

- **5 sculpting tools** - push, pull, smooth, pinch, inflate
- **real-time deformation** - direct vertex manipulation with smooth falloff
- **multiple themes** - warm clay, dark mode, blue ice
- **mobile optimized** - touch controls that actually work
- **keyboard shortcuts** - 1-5 for tools, r to reset, space for auto-spin
- **color sync** - title changes color to match your clay

## process

- started with basic [threejs sphere](https://threejs.org/docs/#api/en/geometries/SphereGeometry) and [vertex manipulation](https://threejs.org/docs/#api/en/core/BufferAttribute) proof of concept
- spent way too long getting the sculpting to [feel natural](https://www.gamedeveloper.com/design/game-feel-a-game-designer-s-guide-to-virtual-sensation) - lots of tweaking w falloff curves and strength values
- built 5 different tools, each with its own [vertex math](https://learnopengl.com/Getting-started/Coordinate-Systems) (push/pull along normals, pinch toward cursor, etc)
- [mobile touch controls](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) were a pain but i would want to play around with the touch sensiivty a bit more if possible
- added multiple themes for a playdoh like feel w multiple colors
-  the ui went through like 3 different designs before settling on the [glassmorphism look](https://uxdesign.cc/glassmorphism-in-user-interfaces-1f39bb1308c9)
- added [keyboard shortcuts](https://ux.stackexchange.com/questions/30682/keyboard-shortcuts-ux-best-practices) after realizing clicking buttons constantly was annoying

- custom sculpting engine that finds vertices within brush radius and applies [smooth falloff](https://docs.blender.org/manual/en/latest/sculpt_paint/sculpting/tools/smooth.html) - closer vertices get more deformation, creating natural clay-like behavior. uses raycasting to find where you click on the sphere, then loops through all vertices calculating distance from that point. vertices within the brush radius get moved based on a squared falloff curve (closer = more movement). each tool has different math - push moves along vertex normals inward, pull moves outward, pinch pulls toward cursor position, smooth blends back to original sphere shape 
- [responsive design](https://web.dev/responsive-web-design-basics/) that actually works on mobile
- [dynamic lighting](https://threejs.org/docs/#api/en/lights/DirectionalLight) and [shadow mapping](https://threejs.org/examples/#webgl_shadowmap_viewer) for realistic clay appearance

## how it works

starts with a high-res sphere (64x32 subdivs) and uses raycasting to find where you click. then it loops through vertices within your brush radius and applies different deformation algs based on the selected tool. each tool has its own math - push moves along normals, pinch pulls toward cursor position, smooth blends back to original shape.

the tricky part was getting the falloff curves right so it feels natural and not chunky. touch needed stronger multipliers since mobile users expect bigger changes.

## try it

go to https://clayable.vercel.app in your browser


## challenges

- performance on mobile was tricky - i had to balance sphere resolution vs frame rate
- getting touch events to feel responsive without being too sensitive 
- preventing camera rotation while sculpting (fixed it w proper event handling)
- making each tool feel distinctly different - took lots of tweaking strength values
- falloff curves that looked smooth instead of chunky or artificial
- cross-browser compatibility with webgl and touch events

## what i learned

- vertex manipulation was way more math than expected but super satisfying when it works
- mobile users need bigger visual feedback
- documentation and comments are important when you come back to complex math later

## additions

- save/load sculptures to localStorage 
- undo/redo system for mistakes
- more sculpting tools (flatten, grab, etc)
- texture painting on top of sculpting
- export to .obj or .stl files
- multiplayer collaborative sculpting
- procedural clay textures for more realism
