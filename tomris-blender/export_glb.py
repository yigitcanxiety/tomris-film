# Export the TOMRIS boat (only) to a clean GLB for the three.js engine, with a baked AO atlas.
#   python3 export_glb.py [out.glb] [ao.jpg] [ao_size] [samples]          (bpy module; opens tomris.blend)
#   blender -b tomris.blend -P export_glb.py -- [out.glb] [ao.jpg] [ao_size] [samples]
# Defaults: ../tomris-three/assets/tomris.glb, ../tomris-three/assets/boat/ao.jpg, 4096 px, 96 samples.
# Full rebuild from scratch:   python3 build.py && python3 export_glb.py
# 1. keeps only the TOMRIS hierarchy (pivot names intact), applies modifiers
# 2. merges meshes that share a parent pivot + material (draw calls: ~450 -> ~60); nav lenses, screens and the
#    flag stay separate (boat.js finds them by material / name)
# 3. one shared UV atlas (UVMap = TEXCOORD_0) over every mesh except the flag (which keeps its texture UVs)
# 4. Cycles AO bake of the whole boat into that atlas (glass / lenses / flag hidden so they do not occlude)
# 5. plain Principled materials (three.js re-adds paint detail in its own shader), embeds the flag texture
import bpy, sys, os, math, time

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
out = os.path.abspath(argv[0] if argv else os.path.join(HERE, '..', 'tomris-three', 'assets', 'tomris.glb'))
if not bpy.data.filepath:                                   # run as `python3 export_glb.py` (bpy module)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'tomris.blend'))
ao_path = os.path.abspath(argv[1] if len(argv) > 1 else os.path.join(os.path.dirname(out), 'boat', 'ao.jpg'))
AO_SIZE = int(argv[2]) if len(argv) > 2 else 4096
SAMPLES = int(argv[3]) if len(argv) > 3 else 96
T0 = time.time()
def log(*a): print('[export %6.1fs]' % (time.time() - T0), *a, flush=True)

root = bpy.data.objects['TOMRIS']
keep = set()
def walk(o):
    keep.add(o.name)
    for c in o.children: walk(c)
walk(root)
for o in list(bpy.data.objects):
    if o.name not in keep: bpy.data.objects.remove(o, do_unlink=True)

flag = bpy.data.objects['Flag']; flag.modifiers.clear()     # cloth waving is done in the vertex shader

def avg(a, b): return [(x + y) / 2 for x, y in zip(a, b)]
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N.get('Principled BSDF')
    if b is None:                                            # tinted glass (transparent+glossy mix)
        tint = N['Transparent BSDF'].inputs['Color'].default_value[:3]
        for n in list(N):
            if n.type != 'OUTPUT_MATERIAL': N.remove(n)
        b = N.new('ShaderNodeBsdfPrincipled'); L.new(b.outputs[0], N['Material Output'].inputs['Surface'])
        b.inputs['Base Color'].default_value = (*[c * 0.15 for c in tint], 1)
        b.inputs['Roughness'].default_value = 0.03; b.inputs['Alpha'].default_value = 0.6
        m.surface_render_method = 'BLENDED'
        continue
    bc = b.inputs['Base Color']
    if bc.is_linked:
        src = bc.links[0].from_node
        if src.type == 'MIX':
            bc.default_value = (*avg(src.inputs['A'].default_value[:3], src.inputs['B'].default_value[:3]), 1)
            L.remove(bc.links[0])
        elif src.type == 'HUE_SAT':                          # flag: image -> base colour directly
            img = src.inputs['Color'].links[0].from_node
            L.remove(bc.links[0]); L.new(img.outputs['Color'], bc)
    r = b.inputs['Roughness']
    if r.is_linked:
        src = r.links[0].from_node
        r.default_value = (src.inputs['To Min'].default_value + src.inputs['To Max'].default_value) / 2
        L.remove(r.links[0])
    if b.inputs['Normal'].is_linked: L.remove(b.inputs['Normal'].links[0])

# ---- apply modifiers
vl = bpy.context.view_layer
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
vl.objects.active = meshes[0]
bpy.ops.object.convert(target='MESH')                       # bakes bevel/solidify/boolean into the meshes
log('modifiers applied', len(meshes), 'meshes')

# ---- merge by (parent pivot, materials)
SEPARATE = {'nav_red', 'nav_green', 'nav_white', 'screen_dim', 'turkish_flag'}
groups = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name == 'Flag': continue
    mats = tuple(s.material.name for s in o.material_slots if s.material)
    if not mats or set(mats) & SEPARATE: continue
    groups.setdefault((o.parent.name if o.parent else '', mats), []).append(o)
for (par, mats), obs in groups.items():
    if len(obs) < 2: continue
    big = max(obs, key=lambda o: len(o.data.polygons))
    with bpy.context.temp_override(active_object=big, object=big, selected_objects=obs, selected_editable_objects=obs):
        bpy.ops.object.join()
    big.name = '%s__%s' % (par or 'root', '+'.join(mats)); big.data.name = big.name
log('merged ->', sum(1 for o in bpy.data.objects if o.type == 'MESH'), 'meshes')

# ---- one UV layer per mesh, single packed atlas
atlas = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Flag']
for o in atlas:
    me = o.data
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UVMap')
bpy.ops.object.select_all(action='DESELECT')
for o in atlas: o.select_set(True)
vl.objects.active = atlas[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, margin=0.0015)
bpy.ops.object.mode_set(mode='OBJECT')
log('uv atlas done')

# ---- AO bake
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.render.bake.margin = 8
sc.world.light_settings.distance = 0.9                      # AO reach: contact shadows of fittings + cabin overhangs
glassy = {'glass_tinted', 'seeker_glass', 'sensor_lens', 'nav_red', 'nav_green', 'nav_white', 'turkish_flag', 'halyard'}
for o in bpy.data.objects:
    if o.type == 'MESH' and (o.name == 'Flag' or all(s.material and s.material.name in glassy for s in o.material_slots)):
        o.hide_render = True                                # glass / lenses / flag do not occlude
img = bpy.data.images.new('boat_ao', AO_SIZE, AO_SIZE, alpha=False, float_buffer=True)
img.colorspace_settings.name = 'Non-Color'
img.generated_color = (1, 1, 1, 1)
mats = {s.material for o in atlas for s in o.material_slots if s.material}
for m in mats:
    tn = m.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = img; tn.name = 'AO_BAKE'
    m.node_tree.nodes.active = tn
bake_objs = [o for o in atlas if not o.hide_render]
bpy.ops.object.select_all(action='DESELECT')
for o in bake_objs: o.select_set(True)
vl.objects.active = bake_objs[0]
bpy.ops.object.bake(type='AO', margin=8, margin_type='EXTEND', use_clear=True)
log('AO bake done, %d objects, %d px, %d spp' % (len(bake_objs), AO_SIZE, SAMPLES))
# light denoise: 3x3 median-ish blur via numpy (island interiors only change slightly; margins were extended)
try:
    import numpy as np
    px = np.empty(AO_SIZE * AO_SIZE * 4, np.float32); img.pixels.foreach_get(px); a = px.reshape(AO_SIZE, AO_SIZE, 4)[..., 0]
    p = np.pad(a, 1, mode='edge')
    nb = np.stack([p[1 + dy:AO_SIZE + 1 + dy, 1 + dx:AO_SIZE + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], 0)
    a2 = np.median(nb, 0) * 0.5 + nb.mean(0) * 0.5
    px = px.reshape(AO_SIZE, AO_SIZE, 4); px[..., 0] = px[..., 1] = px[..., 2] = a2; px[..., 3] = 1
    img.pixels.foreach_set(px.ravel())
except Exception as e: print('denoise skipped', e)
os.makedirs(os.path.dirname(ao_path), exist_ok=True)
img.filepath_raw = ao_path; img.file_format = 'JPEG' if ao_path.lower().endswith('.jpg') else 'PNG'
sc.render.image_settings.quality = 92
try: img.save(quality=92)
except TypeError: img.save()
for m in mats: m.node_tree.nodes.remove(m.node_tree.nodes['AO_BAKE'])
for o in bpy.data.objects: o.hide_render = False

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_lights=False, export_cameras=False, export_animations=False,
                          export_image_format='AUTO', export_texcoords=True, export_normals=True)
log('EXPORT OK', out, len([o for o in bpy.data.objects if o.type == 'MESH']), 'meshes', tris, 'tris',
    os.path.getsize(out), 'bytes; AO', ao_path, os.path.getsize(ao_path), 'bytes')
