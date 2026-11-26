# Export the TOMRIS boat (only) to a clean GLB for the three.js engine, with a baked AO atlas.
#   Blender -b tomris.blend -P export_glb.py -- <out.glb> [ao.png] [ao_size] [samples]
# 1. keeps only the TOMRIS hierarchy (pivot names intact), applies modifiers
# 2. one shared UV atlas (UVMap = TEXCOORD_0) over every mesh except the flag (which keeps its texture UVs)
# 3. Cycles AO bake of the whole boat into that atlas (glass hidden so it does not occlude), Non-Color
# 4. plain Principled materials (three.js re-adds paint detail in its own shader), embeds the flag texture
import bpy, sys, os, math

argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]
ao_path = argv[1] if len(argv) > 1 else os.path.join(os.path.dirname(out), 'boat', 'ao.png')
AO_SIZE = int(argv[2]) if len(argv) > 2 else 2048
SAMPLES = int(argv[3]) if len(argv) > 3 else 128

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

# ---- apply modifiers, one UV layer per mesh, single packed atlas
vl = bpy.context.view_layer
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
vl.objects.active = meshes[0]
bpy.ops.object.convert(target='MESH')                       # bakes bevel/solidify/boolean into the meshes
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
bpy.ops.uv.pack_islands(rotate=True, margin=0.0025)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- AO bake
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'                                    # Metal kernel compile takes >10 min cold; AO on CPU is fast
sc.cycles.samples = SAMPLES
sc.world.light_settings.distance = 0.9                      # AO reach: contact shadows of fittings + cabin overhangs
glassy = {'glass_tinted', 'seeker_glass', 'nav_red', 'nav_green', 'nav_white', 'turkish_flag', 'halyard'}
for o in bpy.data.objects:
    if o.type == 'MESH' and (o.name == 'Flag' or all(s.material and s.material.name in glassy for s in o.material_slots)):
        o.hide_render = True                                # glass / lenses / flag do not occlude
img = bpy.data.images.new('boat_ao', AO_SIZE, AO_SIZE, alpha=False)
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
import time; t0 = time.time()
bpy.ops.object.bake(type='AO', margin=6, margin_type='EXTEND', use_clear=True)
print('AO BAKE %.1fs, %d objects' % (time.time() - t0, len(bake_objs)), flush=True)
os.makedirs(os.path.dirname(ao_path), exist_ok=True)
img.filepath_raw = ao_path; img.file_format = 'PNG'; img.save()
for m in mats: m.node_tree.nodes.remove(m.node_tree.nodes['AO_BAKE'])
for o in bpy.data.objects: o.hide_render = False

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_lights=False, export_cameras=False, export_animations=False,
                          export_image_format='AUTO', export_texcoords=True, export_normals=True)
print('EXPORT OK', out, len(keep), 'objects', tris, 'tris', os.path.getsize(out), 'bytes')
