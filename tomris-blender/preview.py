# Close-up geometry previews of the boat (Cycles CPU, headless; no GPU needed).
#   python3 preview.py [out_dir] [view ...]        (bpy module)   or   blender -b tomris.blend -P preview.py -- [out_dir] [view ...]
# views: rws sensors mast port stbd three4 stern     Neutral overcast-ish light so the shapes, not the grade, are judged.
import bpy, sys, os, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
if not bpy.data.filepath: bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'tomris.blend'))
out = argv[0] if argv else os.path.join(HERE, 'renders', 'preview')
VIEWS = {   # camera, target, lens  (boat static frame: x fwd from transom, y port, z up from DWL)
    'rws': ((12.3, 1.9, 3.3), (9.75, 0.0, 2.35), 45),
    'sensors': ((6.9, 2.4, 4.3), (4.75, 0.0, 3.35), 38),
    'mast': ((0.2, 3.6, 4.6), (3.3, 0.0, 4.0), 45),
    'navlights': ((2.55, 1.0, 4.62), (3.50, 0.05, 4.36), 50),
    'radar': ((5.7, -1.9, 4.6), (4.15, 0.0, 3.9), 38),
    'launcher': ((2.75, 1.25, 2.55), (2.45, 0.2, 2.25), 40),
    'cabin': ((5.6, 3.2, 2.3), (5.4, 0.0, 2.1), 30),
    'port': ((1.5, 5.5, 0.9), (1.45, 0.0, 0.55), 40),
    'stbd': ((1.5, -5.5, 0.9), (1.45, 0.0, 0.55), 40),
    'three4': ((21.0, 13.0, 5.5), (6.3, 0.0, 1.4), 40),
    'stern': ((-7.5, -5.0, 4.0), (2.0, 0.0, 1.9), 35),
}
todo = [a for a in argv[1:] if a in VIEWS] or list(VIEWS)
sc = bpy.context.scene
for o in sc.objects:
    if o.name == 'Sea': o.hide_render = True
w = sc.world; nt = w.node_tree
bg = nt.nodes['Background']
for l in list(bg.inputs['Color'].links): nt.links.remove(l)
bg.inputs['Color'].default_value = (0.55, 0.6, 0.68, 1); bg.inputs['Strength'].default_value = 0.6
sun = bpy.data.objects.get('Sun')
sun.data.energy = 3.0; sun.data.angle = math.radians(3); sun.rotation_euler = (math.radians(50), 0, math.radians(140))
if 'Ground' not in bpy.data.objects:
    bpy.ops.mesh.primitive_plane_add(size=200, location=(6, 0, -0.02)); g = bpy.context.object; g.name = 'Ground'
    m = bpy.data.materials.new('ground'); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.03, 0.04, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.3; g.data.materials.append(m)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 540, 100
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Base Contrast'
except Exception: pass
sc.view_settings.exposure = 0.0
cam = bpy.data.objects.new('PREV_cam', bpy.data.cameras.new('PREV_cam')); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(out, exist_ok=True)
for v in todo:
    loc, tgt, lens = VIEWS[v]
    cam.location = loc; cam.data.lens = lens; cam.data.clip_start = 0.05
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, 'bl_%s.jpg' % v); sc.render.image_settings.file_format = 'JPEG'
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', sc.render.filepath, flush=True)
