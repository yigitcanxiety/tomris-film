# TOMRIS - full procedural rebuild: boat + sea + sky + cameras.  Run:  Blender -b -P build.py
# Boat frame ("static"): x forward from transom (0..13 m), y to PORT, z up from design waterline (DWL).
# Draught 0.7 (keel z=-0.70). Root empty "TOMRIS" applies the planing trim.
# Dimensions were measured from master_varA through a fitted camera (see camfit.py).
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf'
TRIM = math.radians(1.5)          # bow-up planing trim
PIVOT = (0.0, 0.0, 0.0)           # trim pivot: transom at DWL (stern sits, bow lifts)
D2R = math.radians

# ----------------------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
BOAT = bpy.data.collections.new('TOMRIS_boat'); scene.collection.children.link(BOAT)
ENV = bpy.data.collections.new('ENV'); scene.collection.children.link(ENV)

# ----------------------------------------------------------------------------- materials
def principled(name, color, rough=0.5, metal=0.0, emit=None, emit_str=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_str
    return m

def paint(name, color, rough=(0.56, 0.62), grit=0.0):
    """Matte naval paint: very subtle large-scale tone + roughness variation, orange-peel bump."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 0.35; n1.inputs['Detail'].default_value = 3
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 0.8; n2.inputs['Detail'].default_value = 2
    L.new(tc.outputs['Object'], n1.inputs['Vector']); L.new(tc.outputs['Object'], n2.inputs['Vector'])
    ramp = N.new('ShaderNodeMix'); ramp.data_type = 'RGBA'
    ramp.inputs['A'].default_value = (*[c * 0.965 for c in color], 1)
    ramp.inputs['B'].default_value = (*[c * 1.035 for c in color], 1)
    L.new(n1.outputs['Fac'], ramp.inputs['Factor']); L.new(ramp.outputs['Result'], b.inputs['Base Color'])
    mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = rough[0]; mr.inputs['To Max'].default_value = rough[1]
    mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 0.7
    L.new(n2.outputs['Fac'], mr.inputs['Value']); L.new(mr.outputs['Result'], b.inputs['Roughness'])
    b.inputs['Specular IOR Level'].default_value = 0.42
    bn = N.new('ShaderNodeTexNoise'); bn.inputs['Scale'].default_value = 600 if grit else 45
    L.new(tc.outputs['Object'], bn.inputs['Vector'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = grit if grit else 0.015
    bump.inputs['Distance'].default_value = 0.002
    L.new(bn.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

GREY = (0.215, 0.228, 0.243)            # linear; ~sRGB 128/132/136 naval grey
M = {
    'hull': paint('hull_grey', GREY),
    'deck': paint('deck_antiskid', tuple(c * 0.86 for c in GREY), rough=(0.70, 0.82), grit=0.25),
    'super': paint('super_grey', tuple(c * 1.04 for c in GREY)),
    'rubber': principled('rubrail_black', (0.018, 0.018, 0.019), rough=0.62),
    'glass': principled('glass_dark', (0.004, 0.005, 0.006), rough=0.04, spec=0.6),
    'gun': principled('gunmetal', (0.045, 0.048, 0.052), rough=0.38, metal=0.75),
    'wgrey': paint('weapon_grey', (0.17, 0.18, 0.19)),
    'missile': paint('missile_grey', (0.30, 0.31, 0.315)),
    'steel': principled('stainless', (0.55, 0.56, 0.57), rough=0.28, metal=1.0),
    'letter': principled('letter_white', (0.82, 0.82, 0.80), rough=0.5),
    'dark': principled('dark_fittings', (0.03, 0.032, 0.035), rough=0.5),
    'lens': principled('sensor_lens', (0.002, 0.003, 0.004), rough=0.05, spec=0.8),
    'red': principled('nav_red', (0.6, 0.02, 0.02), rough=0.2, emit=(1.0, 0.05, 0.03), emit_str=6),
    'green': principled('nav_green', (0.02, 0.6, 0.1), rough=0.2, emit=(0.05, 1.0, 0.3), emit_str=6),
    'white': principled('nav_white', (0.9, 0.9, 0.85), rough=0.2, emit=(1.0, 0.95, 0.85), emit_str=5),
    'jet': principled('waterjet_metal', (0.06, 0.065, 0.07), rough=0.45, metal=0.6),
    'rope': principled('halyard', (0.04, 0.04, 0.04), rough=0.8),
}

def glass_mat():
    """Tinted glass: transparent dark tint + fresnel gloss, so the empty interior reads through it."""
    m = bpy.data.materials.new('glass_tinted'); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links; out = N['Material Output']; N.remove(N['Principled BSDF'])
    tr = N.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.16, 0.17, 0.18, 1)
    gl = N.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.02
    fr = N.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.52
    ma = N.new('ShaderNodeMath'); ma.operation = 'MULTIPLY_ADD'; ma.inputs[1].default_value = 0.92; ma.inputs[2].default_value = 0.07
    L.new(fr.outputs[0], ma.inputs[0])
    mx = N.new('ShaderNodeMixShader'); L.new(ma.outputs[0], mx.inputs[0])
    L.new(tr.outputs[0], mx.inputs[1]); L.new(gl.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
    return m
M['glass'] = glass_mat()
M['seeker'] = glass_mat(); M['seeker'].name = 'seeker_glass'
M['seeker'].node_tree.nodes['Transparent BSDF'].inputs['Color'].default_value = (0.05, 0.06, 0.07, 1)
M['interior'] = paint('interior_grey', (0.07, 0.075, 0.08), rough=(0.6, 0.7))
M['beacon'] = principled('beacon_amber', (0.55, 0.32, 0.06), rough=0.25)
M['screen'] = principled('screen_dim', (0.01, 0.012, 0.015), rough=0.15, emit=(0.25, 0.45, 0.6), emit_str=0.35)

# ----------------------------------------------------------------------------- mesh helpers
PARENT = []          # pivot stack: objects created while a pivot is pushed get parented to it
PIV_LOC = {}
def link(obj, coll=None):
    (coll or BOAT).objects.link(obj)
    if PARENT:
        obj.parent = PARENT[-1]; obj.matrix_parent_inverse = Matrix.Translation(PIV_LOC[PARENT[-1].name]).inverted()
    return obj

def pivot(name, loc, size=0.3):
    """Animation pivot empty (unrotated at build time; parented to the current pivot)."""
    e = bpy.data.objects.new(name, None); e.empty_display_type = 'ARROWS'; e.empty_display_size = size
    e.location = loc; link(e); PIV_LOC[name] = Vector(loc); return e

def mesh_obj(name, verts, faces, mat, smooth=None, coll=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = link(bpy.data.objects.new(name, me), coll)
    if isinstance(mat, list):
        for mm in mat: me.materials.append(mm)
    else:
        me.materials.append(mat)
    if smooth is not None:
        for p in me.polygons: p.use_smooth = True
        me.set_sharp_from_angle(angle=D2R(smooth))
    return ob

def bm_to_obj(name, bm, mat, smooth=None, bevel=0.0, coll=None, seg=2, ang=25):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me), coll); me.materials.append(mat)
    if smooth is not None:
        for p in me.polygons: p.use_smooth = True
        me.set_sharp_from_angle(angle=D2R(smooth))
    if bevel:
        bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg
        bv.limit_method = 'ANGLE'; bv.angle_limit = D2R(ang); bv.harden_normals = True
        for p in me.polygons: p.use_smooth = True
    return ob

def hull_obj(name, pts, mat, bevel=0.0, mirror_y=False, dissolve=True, seg=2):
    pts = [Vector(p) for p in pts]
    if mirror_y: pts += [Vector((p.x, -p.y, p.z)) for p in pts if abs(p.y) > 1e-6]
    bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.delete(bm, geom=list(set(res['geom_interior'] + res['geom_unused'])), context='VERTS')
    if dissolve: bmesh.ops.dissolve_limit(bm, angle_limit=D2R(1.0), verts=bm.verts[:], edges=bm.edges[:])
    return bm_to_obj(name, bm, mat, bevel=bevel, seg=seg)

def navlight(name, loc, color, watts=2.0):
    li = bpy.data.lights.new(name, 'POINT'); li.energy = watts; li.color = color; li.shadow_soft_size = 0.03
    li.use_shadow = False; ob = bpy.data.objects.new(name, li); ob.location = loc; return link(ob)

def box(name, c, s, mat, rot=(0, 0, 0), bevel=0.0, seg=2, ang=25):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=s, verts=bm.verts)
    R = Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ R, verts=bm.verts)
    return bm_to_obj(name, bm, mat, bevel=bevel, seg=seg, ang=ang)

def cyl(name, p0, p1, r, mat, seg=24, r1=None, smooth=True, caps=True):
    p0, p1 = Vector(p0), Vector(p1); ax = p1 - p0; L = ax.length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, segments=seg, radius1=r, radius2=(r if r1 is None else r1), depth=L)
    q = Vector((0, 0, 1)).rotation_difference(ax.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return bm_to_obj(name, bm, mat, smooth=40 if smooth else None)

def lathe(name, prof, p0, axis, mat, seg=32):
    """prof: [(t, r)] along axis from p0. Closed at r=0 ends."""
    axis = Vector(axis).normalized(); q = Vector((0, 0, 1)).rotation_difference(axis)
    verts, faces, rings = [], [], []
    for t, r in prof:
        if r < 1e-6: rings.append([len(verts)]); verts.append((0, 0, t))
        else:
            rings.append(list(range(len(verts), len(verts) + seg)))
            verts += [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), t) for i in range(seg)]
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1: continue
        if len(a) == 1: faces += [(a[0], b[i], b[(i + 1) % seg]) for i in range(seg)]
        elif len(b) == 1: faces += [(a[i], b[0], a[(i + 1) % seg]) for i in range(seg)]
        else: faces += [(a[i], b[i], b[(i + 1) % seg], a[(i + 1) % seg]) for i in range(seg)]
    T = Matrix.Translation(p0) @ q.to_matrix().to_4x4()
    verts = [T @ Vector(v) for v in verts]
    ob = mesh_obj(name, verts, faces, mat, smooth=50)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return ob

def plane_poly(name, pts, mat, offset=0.0, normal=None):
    pts = [Vector(p) for p in pts]
    n = normal or (pts[1] - pts[0]).cross(pts[2] - pts[0]).normalized()
    return mesh_obj(name, [p + n * offset for p in pts], [list(range(len(pts)))], mat)

def inset_poly(pts, d):
    """Inset a planar convex polygon by distance d (in its own plane)."""
    P = [Vector(p) for p in pts]; n = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    if n.dot(sum((p.cross(q) for p, q in zip(P, P[1:] + P[:1])), Vector())) < 0: n = -n
    lines = []
    for a, b in zip(P, P[1:] + P[:1]):
        e = (b - a).normalized(); inward = n.cross(e)
        lines.append((a + inward * d, e))
    out = []
    for (a1, e1), (a2, e2) in zip(lines[-1:] + lines[:-1], lines):
        # intersect a1 + s e1 with a2 + t e2 (coplanar)
        w = a2 - a1; c = e1.cross(e2); s = w.cross(e2).dot(c) / max(c.length_squared, 1e-12)
        out.append(a1 + e1 * s)
    return out, n

CUTS = []   # window opening prisms cut out of the wheelhouse shell
def window(name, pts, d_frame=0.025, d_glass=0.055, outward=None, cut=True):
    """Black rubber frame ring on the face + recessed tinted glass in a real opening."""
    fr, n = inset_poly(pts, d_frame); gl, _ = inset_poly(pts, d_glass)
    if outward is not None and n.dot(Vector(outward)) < 0: n = -n
    k = len(fr)
    ring = [p + n * 0.014 for p in fr] + [p + n * 0.014 for p in gl] + [p - n * 0.004 for p in fr] + [p - n * 0.02 for p in gl]
    q = lambda a, b: [(a + i, a + (i + 1) % k, b + (i + 1) % k, b + i) for i in range(k)]
    gk = mesh_obj(name + '_frame', ring, q(0, k) + q(2 * k, 0) + q(k, 3 * k), M['rubber'])
    bm = bmesh.new(); bm.from_mesh(gk.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(gk.data); bm.free()
    plane_poly(name + '_glass', gl, M['glass'], -0.015 if cut else 0.006, n)
    if cut: CUTS.append((gl, n))
    return gl, n

# ----------------------------------------------------------------------------- hull lines
def chaikin(pts, it=3):
    for _ in range(it):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            new += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        new.append(pts[-1]); pts = new
    return pts

KEEL = chaikin([(0, -0.70), (4.5, -0.70), (6.5, -0.67), (8.5, -0.57), (9.8, -0.44), (10.8, -0.27),
                (11.6, 0.0), (12.3, 0.865), (13.0, 1.73)], 3)
KX = np.array([p[0] for p in KEEL]); KZ = np.array([p[1] for p in KEEL])
def keel_z(x): return float(np.interp(x, KX, KZ))
def sheer_z(x): return 1.21 + 0.040 * x
def rail_z(x): return 0.84 + 0.047 * x
def cock_z(x): return 0.80 + 0.04 * x
XCOCK = 3.0
def hb_sheer(x):
    if x <= 5.5: return 1.66 + 0.04 * min(x, 1.0)
    t = min((x - 5.5) / 7.5, 1.0); return 1.70 * (1 - t ** 2.2)
XCE = 12.3
def chine(x):
    if x <= 4.5: return 1.62, 0.02
    t = min((x - 4.5) / (XCE - 4.5), 1.0)
    return 1.62 * (1 - t ** 2.0), 0.02 + (keel_z(XCE) - 0.02) * t ** 1.8
def fade(x, a, b): return float(np.clip((b - x) / (b - a), 0, 1))

def section(x):
    """Half section (port, y>=0) from keel to deck centre."""
    zk = keel_z(x); yc, zc = chine(x)
    if x >= XCE: yc, zc = 0.0, zk
    pts = [(0.0, zk)]
    w = 0.045 * fade(x, 9.0, 11.5)
    for f in (0.36, 0.68):
        ay, az = f * yc, zk + f * (zc - zk)
        cz = zk + (ay + w) / yc * (zc - zk) if yc > 1e-4 else az
        pts += [(ay, az), (ay + w, az - 0.004 * (w > 0)), (ay + w, cz)]
    cf = 0.07 * fade(x, 10.0, 12.2)
    pts += [(yc, zc), (yc + cf, zc)]
    ys, zs = hb_sheer(x), sheer_z(x)
    pts.append((ys, zs))
    yi = max(ys - 0.06, 0.0)
    if x < XCOCK:
        zd = cock_z(x); pts += [(yi, zs), (yi, zd), (yi * 0.5, zd), (0.0, zd)]
    else:
        cam = 0.06 * yi / 1.7
        pts += [(yi, zs + 0.0005), (yi, zs + 0.001), (yi * 0.5, zs + cam * 0.75), (0.0, zs + cam)]
    return pts

def side_y(x, z):
    """Outer hull side half-breadth at height z (between chine flat and sheer)."""
    s = section(x); y0, z0 = s[8]; ys, zs = s[9]
    return y0 + (ys - y0) * (z - z0) / max(zs - z0, 1e-6)

# ----------------------------------------------------------------------------- hull
def build_hull():
    xs = sorted(set(np.round(np.concatenate([
        np.linspace(0, 2.99, 16), [2.999, 3.001], np.linspace(3.1, 10, 36),
        np.linspace(10.1, 12.2, 22), np.linspace(12.25, 12.97, 16)]), 4)))
    verts, faces, rings = [], [], []
    for x in xs:
        h = section(x)
        ring = [(x, y, z) for y, z in h] + [(x, -y, z) for y, z in reversed(h[1:-1])]
        rings.append(list(range(len(verts), len(verts) + len(ring)))); verts += ring
    n = len(rings[0])
    for a, b in zip(rings[:-1], rings[1:]):
        faces += [(a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]) for j in range(n)]
    faces.append(list(reversed(rings[0]))); faces.append(rings[-1])
    ob = mesh_obj('Hull', verts, faces, [M['hull'], M['deck']], smooth=28)
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 2; bv.limit_method = 'ANGLE'
    bv.angle_limit = D2R(40); bv.harden_normals = True
    me = ob.data
    for p in me.polygons:   # deck-ish upward faces above waterline get antiskid
        if p.normal.z > 0.9 and p.center.z > 0.6 and p.area > 1e-4: p.material_index = 1
    return ob

def build_rubrail():
    pts = []
    for x in np.linspace(-0.04, 12.9, 260):
        z = rail_z(x)
        if z <= keel_z(x) + 0.02: break
        pts.append((x, side_y(max(x, 0.0), z) + 0.035, z))
    xt = pts[-1][0]
    tip = [(xt + 0.05, 0.02, rail_z(xt)), (xt + 0.065, 0.0, rail_z(xt)), (xt + 0.05, -0.02, rail_z(xt))]
    path = pts + tip + [(x, -y, z) for x, y, z in reversed(pts)]
    cu = bpy.data.curves.new('RubRail', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(path) - 1)
    for p, c in zip(sp.points, path): p.co = (*c, 1)
    cu.bevel_depth = 0.075; cu.bevel_resolution = 4; cu.use_fill_caps = True
    ob = bpy.data.objects.new('RubRail_tmp', cu); BOAT.objects.link(ob)
    return to_mesh(ob, 'RubRail', M['rubber'])

def to_mesh(ob, name, mat):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); me.name = name
    bpy.data.objects.remove(ob)
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    new = link(bpy.data.objects.new(name, me)); return new

# ----------------------------------------------------------------------------- deckhouse
Z_KN, Z_ROOF, HW_LO, HW_ROOF = 1.93, 2.97, 1.38, 0.95
def up_y(z): return HW_LO - (HW_LO - HW_ROOF) * (z - Z_KN) / (Z_ROOF - Z_KN)   # upper side plane
def aft_x(z): return 2.95 + (z - 0.88) * 0.13                                   # raked aft wall
W2 = (7.20, 0.55, 2.20); W3 = (6.80, up_y(2.20), 2.20)
T1 = (6.65, 0.0, 2.80); T2 = (6.65, 0.50, 2.80)
def _t3():   # corner pane must be planar: solve x of its top-outer corner on the side plane
    w2, w3, t2 = Vector(W2), Vector(W3), Vector(T2); n = (w3 - w2).cross(t2 - w2); y, z = up_y(2.80), 2.80
    return (w2.x - (n.y * (y - w2.y) + n.z * (z - w2.z)) / n.x, y, z)
T3 = _t3()

def build_deckhouse():
    # Cabin (convex): windshield planes are extended below the pane line so the concave
    # glacis/windshield junction is formed by a separate glacis wedge that overlaps it.
    w2, w3, t2, t3 = Vector(W2), Vector(W3), Vector(T2), Vector(T3)
    k = (2.20 - 1.30) / 0.6
    cb1 = w2 + (w2 - t2) * k; cb0 = Vector((cb1.x, 0.0, 1.30))
    f2 = w3 + (w3 - t3) * ((2.20 - Z_KN) / 0.6)                 # corner/side edge meets knuckle (y=HW_LO)
    nk = (w3 - w2).cross(t2 - w2)                              # corner pane plane: point at (y=HW_LO, z=1.30)
    cb2 = Vector((w2.x - (nk.y * (HW_LO - w2.y) + nk.z * (1.30 - w2.z)) / nk.x, HW_LO, 1.30))
    half = [(2.95, HW_LO, 0.88), (aft_x(Z_KN), HW_LO, Z_KN), (aft_x(Z_ROOF), HW_ROOF, Z_ROOF),
            W2, W3, T1, T2, T3, (6.25, 0.0, Z_ROOF), (6.10, HW_ROOF, Z_ROOF), f2, cb0, cb1, cb2]
    ob = hull_obj('Wheelhouse', half, M['super'], bevel=0.018, mirror_y=True)
    hull_obj('Glacis', [(W2[0], 0.0, 2.20), W2, W3, f2, (8.0, HW_LO, 1.30), (9.9, 0.45, 1.375),
                        (6.95, 0.0, 1.32), (6.95, 1.0, 1.32), (6.95, 0.5, 2.10)], M['super'], bevel=0.018, mirror_y=True)
    for s in (1, -1):
        m = lambda p: (p[0], s * p[1], p[2])
        # windshield: two centre panes split by a mullion, plus raked corner panes
        window('WS_c%d' % s, [m((W2[0], 0.02, 2.2)), m(W2), m(T2), m((T2[0], 0.02, 2.8))], outward=(1, 0, 1))
        window('WS_k%d' % s, [m(W2), m(W3), m(T3), m(T2)], outward=(1, s, 1))
        # side window: one large tinted pane (master_varA) with a thin black mullion
        pts = [(px, s * up_y(pz), pz) for px, pz in ((6.72, 2.06), (4.40, 2.06), (4.12, 2.62), (6.13, 2.62))]
        window('Side_%d' % s, pts, outward=(0, s, 0.3))
        mul = [(px, s * (up_y(pz) + 0.006), pz) for px, pz in ((5.575, 2.07), (5.535, 2.07), (5.535, 2.61), (5.575, 2.61))]
        plane_poly('Side_mullion_%d' % s, mul if s > 0 else mul[::-1], M['rubber'])
        # aft wall windows
        for y0, y1 in ((0.55, 1.0),):
            pts = [(aft_x(z), s * y, z) for y, z in ((y0, 1.95), (y1, 1.95), (y1, 2.55), (y0, 2.55))]
            window('Aft_%d' % s, pts, outward=(-1, 0, 0))
        # grab rail under the side windows
        z = 1.985; y = s * (up_y(z) + 0.06)
        cyl('GrabRail_%d' % s, (4.3, y, z), (6.55, y, z), 0.016, M['steel'], seg=10)
        for gx in (4.4, 5.45, 6.45): cyl('GrabPost_%d_%.1f' % (s, gx), (gx, s * up_y(z), z), (gx, y, z), 0.013, M['steel'], seg=8)
        # vertical grab rail at the aft corner
        gy = s * (HW_LO - 0.08)
        cyl('AftGrab_%d' % s, (aft_x(1.45) - 0.07, gy, 1.45), (aft_x(2.35) - 0.07, gy, 2.35), 0.016, M['steel'], seg=10)
        # deck light box on the side (master: small box at the fwd end)
        box('SideBox_%d' % s, (7.0, s * (HW_LO + 0.03), 1.82), (0.12, 0.06, 0.13), M['super'], bevel=0.008)
    # aft door (raised panel + window)
    zc = 1.80; door = [(aft_x(z) - 0.012, y, z) for y, z in ((-0.36, 0.95), (0.36, 0.95), (0.36, 2.62), (-0.36, 2.62))]
    dn = Vector((-1, 0, 0.13)).normalized()
    plane_poly('Door_gap', inset_poly(door, -0.02)[0], M['rubber'], 0.003, dn)
    dc = sum((Vector(p) for p in door), Vector()) / 4 + dn * 0.022
    box('Door', dc, (0.03, 0.72, 1.67), M['super'], rot=(0, math.atan2(dn.z, -dn.x), 0), bevel=0.012, seg=3)
    for hz in (1.15, 2.40):                                    # hinges on the port edge
        cyl('DoorHinge', (aft_x(hz) - 0.045, 0.375, hz - 0.07), (aft_x(hz) - 0.045, 0.375, hz + 0.07), 0.018, M['steel'], seg=12)
    for hz in (1.30, 2.30):                                    # dogs on the starboard edge
        box('DoorDog', (aft_x(hz) - 0.05, -0.33, hz), (0.03, 0.08, 0.025), M['steel'], bevel=0.006)
    window('DoorWin', [(aft_x(z) - 0.043, y, z) for y, z in ((-0.2, 2.05), (0.2, 2.05), (0.2, 2.45), (-0.2, 2.45))], outward=(-1, 0, 0), cut=False)
    cyl('DoorHandle', (aft_x(1.75) - 0.075, -0.31, 1.68), (aft_x(1.75) - 0.075, -0.31, 1.84), 0.013, M['steel'], seg=10)
    for hz in (1.68, 1.84): cyl('DoorHandleLeg', (aft_x(hz) - 0.04, -0.31, hz), (aft_x(hz) - 0.08, -0.31, hz), 0.010, M['steel'], seg=8)
    # --- hollow shell with real window openings, then bake modifiers into the mesh
    ob.data.materials.append(M['interior'])
    so = ob.modifiers.new('shell', 'SOLIDIFY'); so.thickness = 0.04; so.offset = -1; so.use_even_offset = True; so.material_offset = 1
    verts, faces = [], []
    for gl, n in CUTS:
        k = len(gl); o = len(verts)
        verts += [p - n * 0.25 for p in gl] + [p + n * 0.25 for p in gl]
        faces += [tuple(range(o, o + k))[::-1], tuple(range(o + k, o + 2 * k))]
        faces += [(o + i, o + (i + 1) % k, o + k + (i + 1) % k, o + k + i) for i in range(k)]
    me = bpy.data.meshes.new('cutters'); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    cutter = bpy.data.objects.new('cutters', me); scene.collection.objects.link(cutter)
    bo = ob.modifiers.new('windows', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cutter; bo.solver = 'EXACT'
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); old = ob.data; ob.data = baked; baked.name = 'Wheelhouse'
    bpy.data.meshes.remove(old); ob.modifiers.clear(); bpy.data.objects.remove(cutter)
    for p in baked.polygons: p.use_smooth = True
    baked.set_sharp_from_angle(angle=D2R(30))
    # --- empty interior: floor, low console under the windshield with dim screens (no seats, crew 0)
    box('WH_floor', (5.05, 0, 1.47), (3.85, 2.62, 0.04), M['interior'])
    hull_obj('WH_console', [(6.40, 1.05, 1.49), (6.92, 1.05, 1.49), (6.92, 1.05, 2.02), (6.58, 1.05, 1.98), (6.40, 1.05, 1.74)],
             M['interior'], bevel=0.01, mirror_y=True)
    a, b = Vector((6.58, 0, 1.98)), Vector((6.40, 0, 1.74)); nrm = Vector((-(a - b).z, 0, (a - b).x)).normalized()
    if nrm.x > 0: nrm = -nrm
    for yc in (-0.55, 0.0, 0.55):
        q = [a.lerp(b, 0.15) + Vector((0, yc - 0.22, 0)), a.lerp(b, 0.15) + Vector((0, yc + 0.22, 0)),
             a.lerp(b, 0.85) + Vector((0, yc + 0.22, 0)), a.lerp(b, 0.85) + Vector((0, yc - 0.22, 0))]
        plane_poly('WH_screen', q, M['screen'], 0.004, nrm)
    # wipers (one per windshield pane)
    for s in (1, -1):
        for base, top in (((7.16, s * 0.27, 2.25), (6.82, s * 0.20, 2.64)), ((6.98, s * 0.95, 2.25), (6.62, s * 0.80, 2.66))):
            b, t = Vector(base), Vector(top); up = (t - b).normalized(); out = Vector((0.6, 0, 0.8)).normalized()
            cyl('WiperBoss', b - out * 0.01, b + out * 0.035, 0.022, M['dark'], seg=14)
            cyl('WiperArm', b + out * 0.035, b.lerp(t, 0.75) + out * 0.03, 0.007, M['dark'], seg=6)
            box('WiperBlade', b.lerp(t, 0.55) + out * 0.018, (0.012, 0.016, (t - b).length * 0.85), M['rubber'],
                rot=(0, math.atan2(t.x - b.x, t.z - b.z), 0))
    # roof grab rails along both roof edges + searchlight on the fwd roof
    for s in (1, -1):
        y = s * (HW_ROOF - 0.10)
        cyl('RoofRail_%d' % s, (3.45, y, Z_ROOF + 0.09), (5.95, y, Z_ROOF + 0.09), 0.014, M['steel'], seg=10)
        for gx in (3.5, 4.7, 5.9): cyl('RoofRailPost', (gx, y, Z_ROOF), (gx, y, Z_ROOF + 0.09), 0.012, M['steel'], seg=8)
    cyl('SL_post', (6.05, -0.55, Z_ROOF), (6.05, -0.55, 3.12), 0.03, M['super'], seg=14)
    box('SL_yoke', (6.05, -0.55, 3.15), (0.06, 0.20, 0.05), M['super'], bevel=0.01)
    lathe('SL_body', [(0, 0), (0, 0.06), (0.04, 0.075), (0.17, 0.08), (0.17, 0.0)], (5.98, -0.55, 3.22), (1, 0, 0), M['super'])
    cyl('SL_lens', (6.148, -0.55, 3.22), (6.156, -0.55, 3.22), 0.07, M['lens'], seg=24)
    return ob

# ----------------------------------------------------------------------------- mast & roof sensors
def build_mast():
    hull_obj('Mast', [(3.30, 0.17, Z_ROOF - 0.02), (4.05, 0.17, Z_ROOF - 0.02), (3.36, 0.09, 4.32), (3.58, 0.09, 4.32)],
             M['super'], bevel=0.012, mirror_y=True)
    lathe('MastPost', [(0, 0), (0, 0.085), (0.04, 0.085), (0.07, 0.062), (0.30, 0.062), (0.30, 0)], (3.45, 0, 4.32), (0, 0, 1), M['super'])
    lathe('Masthead', [(0, 0), (0, 0.10), (0.06, 0.10), (0.06, 0.085), (0.22, 0.085), (0.22, 0.10), (0.30, 0.10), (0.32, 0.06), (0.33, 0)],
          (3.45, 0, 4.62), (0, 0, 1), M['super'])
    lathe('MastheadLens', [(0, 0.0), (0, 0.075), (0.14, 0.075), (0.14, 0)], (3.45, 0, 4.69), (0, 0, 1), M['white'])
    # radar arm, brace, pedestal, array
    box('RadarArm', (4.08, 0, 3.74), (0.76, 0.14, 0.08), M['super'], bevel=0.006)
    hull_obj('RadarBrace', [(3.90, 0.05, 3.30), (3.98, 0.05, 3.30), (4.30, 0.05, 3.70), (4.20, 0.05, 3.70)], M['super'], mirror_y=True)
    cyl('RadarPed', (4.28, 0, 3.78), (4.28, 0, 3.97), 0.10, M['super'])
    PARENT.append(pivot('radar_spin', (4.28, 0, 3.97)))
    lathe('RadarGear', [(0, 0), (0, 0.13), (0.07, 0.14), (0.10, 0.12), (0.115, 0.06), (0.115, 0)], (4.28, 0, 3.97), (0, 0, 1), M['super'])
    box('RadarArray', (4.28, 0, 4.15), (1.15, 0.12, 0.13), M['super'], bevel=0.052, seg=5, ang=20)
    box('RadarFace', (4.28, -0.058, 4.15), (0.98, 0.006, 0.085), M['dark'], bevel=0.003)
    for k in (-1, 1): cyl('RadarEndCap', (4.28 + k * 0.50, -0.065, 4.15), (4.28 + k * 0.50, 0.065, 4.15), 0.008, M['dark'], seg=8)
    PARENT.pop().rotation_euler = (0, 0, D2R(40))
    # nav light shelves + lights
    box('NavShelfTop', (3.48, 0, 4.335), (0.16, 0.42, 0.025), M['super'])
    # sidelights: dark housing + inboard screen, cylindrical Fresnel lens outboard (red port, green starboard)
    for s, nm, mat in ((1, 'NavRed', M['red']), (-1, 'NavGreen', M['green'])):
        box(nm + '_housing', (3.49, s * 0.135, 4.39), (0.10, 0.05, 0.095), M['dark'], bevel=0.008)
        box(nm + '_screen', (3.47, s * 0.108, 4.39), (0.16, 0.008, 0.11), M['dark'])
        cyl(nm, (3.515, s * 0.168, 4.355), (3.515, s * 0.168, 4.425), 0.033, mat, seg=20)
        cyl(nm + '_cap', (3.515, s * 0.168, 4.425), (3.515, s * 0.168, 4.437), 0.038, M['dark'], seg=20)
    navlight('NavRed_light', (3.50, 0.20, 4.385), (1, 0.05, 0.03)); navlight('NavGreen_light', (3.50, -0.20, 4.385), (0.05, 1, 0.3))
    navlight('Masthead_light', (3.45, 0, 4.73), (1, 0.93, 0.8))
    box('NavShelfLow', (3.42, 0, 3.775), (0.28, 0.30, 0.025), M['super'])
    lathe('Horn', [(0, 0), (0, 0.025), (0.12, 0.03), (0.20, 0.055), (0.21, 0.055), (0.21, 0)], (3.36, 0.0, 3.83), (1, 0, 0), M['super'], seg=20)
    box('HornBracket', (3.36, 0, 3.80), (0.05, 0.05, 0.05), M['super'])
    # yard + flag halyard + whips
    box('Yard', (3.20, 0, 4.555), (0.36, 0.05, 0.04), M['super'])
    cyl('Halyard1', (3.03, 0.0, 4.54), (3.27, 0.0, 2.99), 0.005, M['rope'], seg=6)
    cyl('Halyard2', (3.05, 0.012, 4.54), (3.30, 0.012, 2.99), 0.004, M['rope'], seg=6)
    cyl('Whip_m1', (3.04, -0.03, 4.55), (3.06, -0.03, 5.16), 0.009, M['dark'], seg=8, r1=0.004)
    cyl('Whip_m2', (3.36, -0.09, 4.40), (3.37, -0.09, 5.30), 0.010, M['dark'], seg=8, r1=0.004)
    # EO/IR gimbal ball
    lathe('EO_base', [(0, 0), (0, 0.20), (0.025, 0.20), (0.04, 0.175), (0.17, 0.16), (0.20, 0.155), (0.20, 0)], (4.46, 0, Z_ROOF), (0, 0, 1), M['super'], seg=40)
    eaz = pivot('eoir_az', (4.46, 0, Z_ROOF + 0.20)); PARENT.append(eaz)
    cyl('EO_turntable', (4.46, 0, Z_ROOF + 0.20), (4.46, 0, Z_ROOF + 0.24), 0.17, M['super'], seg=32)
    for s in (1, -1): box('EO_yoke_%d' % s, (4.46, s * 0.225, 3.33), (0.12, 0.04, 0.22), M['super'], bevel=0.01)
    PARENT.append(pivot('eoir_el', (4.46, 0, 3.43)))
    for s in (1, -1): cyl('EO_axle_%d' % s, (4.46, s * 0.17, 3.43), (4.46, s * 0.21, 3.43), 0.05, M['super'])
    lathe('EO_ball', [(0, 0)] + [(0.19 - 0.19 * math.cos(a), 0.19 * math.sin(a)) for a in np.linspace(0.1, math.pi - 0.1, 14)] + [(0.38, 0)],
          (4.46, 0, 3.24), (0, 0, 1), M['super'])
    c = Vector((4.46, 0, 3.43)); d = Vector((1, 0, 0))
    for nm, off, r in (('EO_IR_window', Vector((0, -0.04, 0.045)), 0.075), ('EO_TV_window', Vector((0, 0.085, -0.07)), 0.04)):
        dd = (d * 0.19 + off).normalized()
        cyl(nm, c + dd * 0.165, c + dd * 0.192, r, M['lens'])
        cyl(nm + '_bezel', c + dd * 0.160, c + dd * 0.188, r + 0.012, M['dark'])
    PARENT.pop(); PARENT.pop()
    eaz.rotation_euler = (0, 0, D2R(72))   # lens looking to port-forward as in master
    # pan-tilt camera turret
    cyl('PT_base', (5.20, 0, Z_ROOF), (5.20, 0, Z_ROOF + 0.10), 0.13, M['super'])
    for s in (1, -1): box('PT_yoke_%d' % s, (5.20, s * 0.17, 3.18), (0.10, 0.035, 0.22), M['super'], bevel=0.008)
    box('PT_body', (5.20, 0, 3.28), (0.36, 0.28, 0.25), M['super'], bevel=0.06, seg=4, ang=20)
    box('PT_shade', (5.23, 0, 3.418), (0.44, 0.30, 0.014), M['super'], bevel=0.005)
    for (yy, zz, r) in ((0.06, 3.28, 0.055), (-0.075, 3.30, 0.03)):
        cyl('PT_hood', (5.36, yy, zz), (5.41, yy, zz), r + 0.012, M['dark'], seg=20)
        cyl('PT_lens', (5.40, yy, zz), (5.412, yy, zz), r, M['lens'], seg=20)
    # roof small items: GPS mushroom, white light post, short whips, aft side lights
    cyl('GPS_post', (5.78, 0.32, Z_ROOF), (5.78, 0.32, 3.08), 0.025, M['super'], seg=12)
    lathe('GPS', [(0, 0), (0, 0.065), (0.05, 0.065), (0.09, 0.0)], (5.78, 0.32, 3.08), (0, 0, 1), M['super'])
    cyl('WhitePost', (6.02, 0.55, Z_ROOF), (6.02, 0.55, 3.07), 0.022, M['super'], seg=12)
    cyl('WhiteLight', (6.02, 0.55, 3.07), (6.02, 0.55, 3.14), 0.04, M['beacon'], seg=16)
    cyl('WhiteCap', (6.02, 0.55, 3.14), (6.02, 0.55, 3.16), 0.045, M['super'], seg=16)
    for nm, (wx, wy, top) in (('Whip_r1', (5.53, 0.70, 3.50)), ('Whip_r2', (3.62, -0.75, 3.95))):
        cyl(nm + '_mount', (wx, wy, Z_ROOF), (wx, wy, Z_ROOF + 0.05), 0.03, M['super'], seg=14)
        cyl(nm + '_spring', (wx, wy, Z_ROOF + 0.05), (wx, wy, Z_ROOF + 0.15), 0.016, M['dark'], seg=10)
        cyl(nm, (wx, wy, Z_ROOF + 0.15), (wx, wy, top), 0.008, M['dark'], seg=8, r1=0.004)
    # stern light (white, aft arc) on the centre stern post
    zt = sheer_z(0.06) + 0.012
    cyl('NavStern_base', (0.06, 0, zt - 0.02), (0.06, 0, zt + 0.02), 0.04, M['dark'], seg=16)
    cyl('NavStern', (0.06, 0, zt + 0.02), (0.06, 0, zt + 0.075), 0.03, M['white'], seg=16)
    cyl('NavStern_cap', (0.06, 0, zt + 0.075), (0.06, 0, zt + 0.09), 0.036, M['dark'], seg=16)

# ----------------------------------------------------------------------------- flag
def build_flag():
    from_png = os.path.join(HERE, 'flag_tr.png')
    make_flag_png(from_png)
    img = bpy.data.images.load(from_png); img.pack()
    m = bpy.data.materials.new('turkish_flag'); m.use_nodes = True
    N = m.node_tree.nodes; b = N['Principled BSDF']
    t = N.new('ShaderNodeTexImage'); t.image = img
    hsv = N.new('ShaderNodeHueSaturation'); hsv.inputs['Value'].default_value = 0.72; hsv.inputs['Saturation'].default_value = 1.1
    m.node_tree.links.new(t.outputs['Color'], hsv.inputs['Color']); m.node_tree.links.new(hsv.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.85; b.inputs['Sheen Weight'].default_value = 0.4
    m.use_backface_culling = False
    # 0.9 x 0.6 m, hoist on the halyard, flying aft; 36 x 24 quads (cloth-ready). uv u=0 at hoist.
    nu, nv, W, Hh = 72, 40, 0.84, 0.56
    hx, z0 = 3.06, 3.86
    verts, faces, uvs = [], [], []
    for j in range(nv + 1):
        for i in range(nu + 1):
            u, v = i / nu, j / nv
            verts.append((hx - u * W, 0.0, z0 + v * Hh)); uvs.append((u, v))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i; faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    PARENT.append(pivot('flag_hoist', (hx, 0.0, z0), 0.15))
    ob = mesh_obj('Flag', verts, faces, m, smooth=180)
    PARENT.pop()
    uv = ob.data.uv_layers.new(name='UVMap')
    for poly in ob.data.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices): uv.data[li].uv = uvs[vi]
    vg = ob.vertex_groups.new(name='pin_hoist')   # for a later cloth sim
    vg.add([j * (nu + 1) for j in range(nv + 1)], 1.0, 'REPLACE')
    # gentle static ripple (non-destructive): wave modifier along the fly
    wv = ob.modifiers.new('ripple', 'WAVE'); wv.use_normal = True; wv.use_normal_x = False; wv.use_normal_z = False
    wv.use_normal_y = True; wv.height = 0.06; wv.width = 0.30; wv.narrowness = 1.2; wv.speed = 0.02
    wv.use_y = False; wv.start_position_x = hx; wv.falloff_radius = 0; wv.time_offset = -30
    sol = ob.modifiers.new('thickness', 'SOLIDIFY'); sol.thickness = 0.002
    return ob

def make_flag_png(path):
    """Official Turkish flag geometry (G = hoist width = 800 px; length 1.5G)."""
    import numpy as np
    W, H = 1200, 800
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    red = np.array([0.890, 0.039, 0.090]); white = np.array([1.0, 1.0, 1.0])
    img = np.tile(red, (H, W, 1))
    outer = (xx - 425) ** 2 + (yy - 400) ** 2 <= 200 ** 2
    inner = (xx - 475) ** 2 + (yy - 400) ** 2 <= 160 ** 2
    img[outer & ~inner] = white
    cx, cy, R = 683.334, 400.0, 100.0          # star circle diameter G/4, one point toward the crescent
    r_in = R * math.cos(math.radians(72)) / math.cos(math.radians(36))
    ang = np.arctan2(yy - cy, xx - cx); rad = np.hypot(xx - cx, yy - cy)
    # pentagram as polar radius function: point at angle pi
    a = np.mod(ang - math.pi, 2 * math.pi / 5) - math.pi / 5      # angle from nearest point
    # boundary radius between point (R) and notch (r_in) along straight edges
    tip = np.array([R, 0.0]); notch = np.array([r_in * math.cos(math.pi / 5), r_in * math.sin(math.pi / 5)])
    # edge line from tip to notch in local polar frame: solve intersection of ray at |a|
    ab = np.abs(a); dx, dy = notch - tip
    t_ray = (tip[0] * dy - tip[1] * dx) / (np.cos(ab) * dy - np.sin(ab) * dx)
    img[rad <= t_ray] = white
    # write PNG via Blender image API (sRGB)
    im = bpy.data.images.new('flag_tmp', W, H, alpha=False)
    px = np.ones((H, W, 4), dtype=np.float32); px[..., :3] = img[::-1]   # flip: blender rows bottom-up
    im.pixels.foreach_set(px.ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

# ----------------------------------------------------------------------------- weapons
def build_rws():
    """12.7 mm remote weapon station: chamfered armoured housing, rounded cradle, sight with day/IR windows."""
    x0, zd = 9.81, sheer_z(9.81) + 0.06 * (hb_sheer(9.81) - 0.06) / 1.7
    lathe('RWS_ring', [(0, 0), (0, 0.37), (0.02, 0.375), (0.11, 0.36), (0.13, 0.33), (0.13, 0)], (x0, 0, zd - 0.05), (0, 0, 1), M['wgrey'], seg=48)
    for i in range(12):                       # ring bolts
        a = 2 * math.pi * i / 12; p = Vector((x0 + 0.352 * math.cos(a), 0.352 * math.sin(a), zd - 0.03))
        cyl('RWS_bolt', p, p + Vector((0, 0, 0.012)), 0.011, M['steel'], seg=6)
    PARENT.append(pivot('gun_az', (x0, 0, zd + 0.08)))
    lathe('RWS_drum', [(0, 0), (0, 0.30), (0.08, 0.30), (0.10, 0.285), (0.10, 0)], (x0, 0, zd + 0.08), (0, 0, 1), M['wgrey'], seg=48)
    zb = zd + 0.18
    prof = [(9.38, zb), (10.15, zb), (10.22, zb + 0.30), (10.08, zb + 0.43), (9.38, zb + 0.43)]
    pts = []
    for x, z in prof:                         # chamfered cross-section: full width low, pulled in at the top edge
        w = 0.30 if z < zb + 0.35 else 0.25
        pts += [(x, w, z)]
        if z < zb + 0.35 and z > zb: pts += [(x, 0.30, z)]
    pts += [(9.40, 0.30, zb + 0.36), (10.12, 0.30, zb + 0.36), (9.43, 0.22, zb + 0.43)]
    hull_obj('RWS_body', pts, M['wgrey'], bevel=0.02, mirror_y=True, seg=3)
    for s in (1, -1):                         # access panels + hinges on the sides
        box('RWS_panel', (9.72, s * 0.303, zb + 0.18), (0.42, 0.006, 0.22), M['wgrey'], bevel=0.003)
        for xx in (9.54, 9.90): box('RWS_latch', (xx, s * 0.31, zb + 0.30), (0.04, 0.012, 0.025), M['dark'])
    zt = zb + 0.43
    PARENT.append(pivot('gun_el', (9.72, 0.0, zt + 0.12)))
    box('RWS_cradle', (9.70, 0.06, zt + 0.08), (0.62, 0.24, 0.16), M['wgrey'], bevel=0.035, seg=3)
    box('RWS_sight', (9.78, -0.24, zt + 0.07), (0.42, 0.17, 0.22), M['wgrey'], bevel=0.04, seg=3)
    box('RWS_sightshade', (9.82, -0.24, zt + 0.19), (0.44, 0.19, 0.012), M['wgrey'], bevel=0.004)
    for (yy, zz, r) in ((-0.205, zt + 0.10, 0.045), (-0.275, zt + 0.10, 0.032), (-0.24, zt + 0.02, 0.025)):
        cyl('RWS_hood', (9.97, yy, zz), (10.02, yy, zz), r + 0.01, M['dark'], seg=18)
        cyl('RWS_sightlens', (10.01, yy, zz), (10.022, yy, zz), r, M['lens'], seg=18)
    box('Gun_receiver', (9.38, 0.07, zt + 0.17), (0.72, 0.13, 0.15), M['gun'], bevel=0.012, seg=2)
    box('Gun_cover', (9.42, 0.07, zt + 0.255), (0.40, 0.12, 0.03), M['gun'], bevel=0.008)
    box('Gun_feed', (9.45, 0.07, zt + 0.25), (0.30, 0.15, 0.04), M['gun'], bevel=0.005)
    cyl('Gun_buffer', (9.02, 0.07, zt + 0.17), (8.96, 0.07, zt + 0.17), 0.045, M['gun'], seg=16)
    box('Gun_charger', (9.30, 0.07 + 0.075, zt + 0.17), (0.10, 0.02, 0.03), M['gun'])
    gz = zt + 0.16
    cyl('Gun_jacket', (9.74, 0.07, gz), (10.12, 0.07, gz), 0.042, M['gun'], seg=24)
    for i in range(4):                       # perforated barrel jacket
        for j in range(6):
            a = 2 * math.pi * j / 6 + (i % 2) * math.pi / 6; xx = 9.82 + i * 0.075
            o = Vector((0, math.cos(a), math.sin(a)))
            cyl('Gun_jacket_hole', Vector((xx, 0.07, gz)) + o * 0.036, Vector((xx, 0.07, gz)) + o * 0.0435, 0.012, M['dark'], seg=10)
    cyl('Gun_barrel', (10.12, 0.07, gz), (10.98, 0.07, gz), 0.027, M['gun'], seg=16)
    lathe('Gun_muzzlebrake', [(0, 0), (0, 0.03), (0.01, 0.037), (0.12, 0.037), (0.125, 0.03), (0.125, 0)], (10.955, 0.07, gz), (1, 0, 0), M['gun'], seg=16)
    for k in (1, -1): box('Gun_brake_slot', (11.02, 0.07 + k * 0.034, gz), (0.06, 0.012, 0.03), M['dark'])
    cyl('Gun_handle', (10.18, 0.07, gz + 0.03), (10.18, 0.07, gz + 0.10), 0.01, M['gun'], seg=8)
    cyl('Gun_handle', (10.18, 0.07, gz + 0.10), (10.30, 0.07, gz + 0.10), 0.012, M['gun'], seg=8)
    box('Ammo_box', (9.55, 0.30, zt + 0.06), (0.42, 0.22, 0.26), M['wgrey'], bevel=0.018, seg=2)
    box('Ammo_lid', (9.55, 0.30, zt + 0.195), (0.44, 0.235, 0.02), M['wgrey'], bevel=0.006)
    for xx in (9.40, 9.70): box('Ammo_latch', (xx, 0.42, zt + 0.15), (0.03, 0.012, 0.05), M['dark'])
    box('Ammo_chute', (9.42, 0.17, zt + 0.17), (0.18, 0.08, 0.05), M['gun'], bevel=0.008)
    PARENT.pop(); PARENT.pop()
    # cable conduit from the deck into the ring
    cyl('RWS_conduit', (x0 - 0.55, -0.28, zd), (x0 - 0.30, -0.24, zd + 0.02), 0.022, M['dark'], seg=10)

def build_launcher():
    zd = cock_z(1.45); px, pz, E = 1.45, 1.96, D2R(12.8); e = 0.0
    d = Vector((1, 0, 0)); n = Vector((0, 0, 1))
    cyl('L_flange', (px, 0, zd), (px, 0, zd + 0.05), 0.26, M['wgrey'], seg=32)
    cyl('L_column', (px, 0, zd + 0.05), (px, 0, 1.70), 0.15, M['wgrey'], seg=32)
    box('L_head', (px, 0, 1.80), (0.42, 0.18, 0.26), M['wgrey'], bevel=0.02)
    box('L_actuator', (px - 0.30, 0, 1.62), (0.07, 0.07, 0.40), M['gun'], rot=(0, D2R(-35), 0))
    lel = pivot('launcher_el', (px, 0, pz)); PARENT.append(lel)
    cyl('L_trunnion', (px, -0.40, pz), (px, 0.40, pz), 0.075, M['wgrey'], seg=24)
    for s in (1, -1):
        y = s * 0.235; P = Vector((px, y, pz))
        for k, off in enumerate((0.145, -0.145)):
            c = P + n * off
            rear, mouth = c - d * 1.38, c + d * 0.85
            cyl('Tube_%d_%d' % (s, k), rear, mouth, 0.11, M['missile'], seg=32)
            for tpos in (-1.25, -0.35, 0.55, 0.80):
                cyl('TubeRing', c + d * (tpos - 0.025), c + d * (tpos + 0.025), 0.122, M['wgrey'], seg=32)
            cyl('TubeCapRear', rear - d * 0.01, rear, 0.095, M['dark'], seg=24)
            # missile: body visible at mouth, ogive nose, small seeker tip
            prof = [(0, 0.0), (0, 0.082), (0.08, 0.082)] + [(0.08 + 0.42 * t, 0.082 * math.sqrt(max(1 - t ** 1.6, 0)) ** 1.1 + 0.0) for t in np.linspace(0.05, 0.92, 12)]
            prof += [(0.08 + 0.42 * 0.96, 0.012), (0.50, 0.0)]
            lathe('Missile_%d_%d' % (s, k), prof, mouth - d * 0.06, d, M['missile'])
            lathe('Seeker_%d_%d' % (s, k), [(0, 0), (0, 0.030), (0.045, 0.016), (0.07, 0.0)], mouth - d * 0.06 + d * 0.43, d, M['seeker'])
            for f in range(4):               # cruciform canards just ahead of the tube mouth
                a = math.pi / 4 + f * math.pi / 2; o = Vector((0, math.cos(a), math.sin(a)))
                base = mouth + d * 0.06
                t = o.cross(d) * 0.004; tri = [base + d * 0.11 + o * 0.08, base + o * 0.08, base + d * 0.015 + o * 0.15]
                hull_obj('Canard', [p + t for p in tri] + [p - t for p in tri], M['missile'], dissolve=False)
        # pod frame (side plate + brackets)
        for tpos in (-0.9, 0.2):
            q = P + d * tpos
            box('PodBracket', q, (0.10, 0.26, 0.56), M['wgrey'], rot=(0, -e, 0), bevel=0.01)
        box('PodRail', P + d * (-0.35) + Vector((0, s * 0.125, 0)), (1.6, 0.03, 0.10), M['wgrey'], rot=(0, -e, 0), bevel=0.005)
    PARENT.pop(); lel.rotation_euler = (0, -E, 0)   # rest pose = master_varA elevation (anim range 0..25 deg)

def build_waterjets():
    for s in (1, -1):
        y = s * 0.62; zc = -0.08
        cyl('Jet_housing_%d' % s, (0.02, y, zc), (-0.42, y, zc), 0.27, M['jet'], seg=32, r1=0.21)
        PARENT.append(pivot('jet_L' if s > 0 else 'jet_R', (-0.42, y, zc), 0.2))
        cyl('Jet_nozzle_%d' % s, (-0.42, y, zc), (-0.70, y, zc), 0.175, M['jet'], seg=32, r1=0.15)
        cyl('Jet_bore_%d' % s, (-0.66, y, zc), (-0.705, y, zc), 0.13, M['dark'], seg=32)
        # reversing bucket: open hood ring behind the nozzle exit, hinged on two side arms
        cyl('Jet_bucket_%d' % s, (-0.72, y, zc + 0.04), (-0.86, y, zc + 0.04), 0.205, M['jet'], seg=32, r1=0.19, caps=False)
        for k in (1, -1): box('Jet_arm', (-0.60, y + k * 0.205, zc + 0.03), (0.30, 0.025, 0.05), M['jet'])
        PARENT.pop()
        box('Jet_plate_%d' % s, (0.01, y, zc + 0.03), (0.03, 0.62, 0.50), M['jet'], bevel=0.01)

# ----------------------------------------------------------------------------- deck fittings
def cleat(name, x, y, z, yaw=0.0):
    box(name + '_base', (x, y, z + 0.012), (0.16, 0.05, 0.024), M['steel'], rot=(0, 0, yaw), bevel=0.006)
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    for k in (-1, 1): cyl(name + '_post', Vector((x, y, z)) + d * k * 0.04, Vector((x, y, z + 0.06)) + d * k * 0.04, 0.012, M['steel'], seg=10)
    c = Vector((x, y, z + 0.068))
    lathe(name + '_horn', [(0, 0), (0, 0.007), (0.025, 0.013), (0.13, 0.017), (0.235, 0.013), (0.26, 0.007), (0.26, 0)], c - d * 0.13, d, M['steel'], seg=12)

def deck_z(x, y):
    yi = hb_sheer(x) - 0.06; return sheer_z(x) + 0.06 * yi / 1.7 * (1 - (abs(y) / max(yi, 1e-3)) ** 2) if x >= XCOCK else cock_z(x)

def build_fittings():
    for s in (1, -1):
        for x in (11.25, 6.85):
            y = s * (hb_sheer(x) - 0.20); cleat('Cleat_%d_%.1f' % (s, x), x, y, deck_z(x, y), yaw=0.0 if x < 10 else s * -0.35)
        y = s * (hb_sheer(0.55) - 0.03); cleat('Cleat_%d_st' % s, 0.55, y, sheer_z(0.55))
    # mushroom vents on the foredeck, bow fairleads, fuel fillers
    for s in (1, -1):
        x = 10.6; y = s * 0.55; z = deck_z(x, y)
        lathe('Vent', [(0, 0), (0, 0.05), (0.06, 0.05), (0.07, 0.11), (0.10, 0.11), (0.11, 0.06), (0.11, 0)], (x, y, z - 0.01), (0, 0, 1), M['super'], seg=24)
        x = 12.05; y = s * (hb_sheer(x) - 0.07); z = deck_z(x, y)
        box('Fairlead', (x, y, z + 0.03), (0.16, 0.035, 0.06), M['steel'], rot=(0, 0, s * -0.5), bevel=0.012, seg=2)
        x = 2.4; y = s * 1.45
        cyl('FuelFiller', (x, y, cock_z(x) - 0.005), (x, y, cock_z(x) + 0.012), 0.055, M['steel'], seg=20)
    # foredeck hatch (aerial view) + glacis hatch with grab-rail frame
    x = 11.15; z = deck_z(x, 0)
    box('Hatch_fwd', (x, 0, z + 0.012), (0.60, 0.60, 0.03), M['super'], bevel=0.012)
    box('Hatch_fwd_gasket', (x, 0, z + 0.002), (0.63, 0.63, 0.012), M['rubber'], bevel=0.004)
    for yy in (-0.2, 0.2): box('Hatch_dog', (x + 0.31, yy, z + 0.025), (0.03, 0.06, 0.02), M['steel'], bevel=0.005)
    box('Hatch_fwd_hinge', (x - 0.31, 0, z + 0.02), (0.03, 0.40, 0.03), M['steel'])
    # glacis plane: through W2, W2' and (9.9,0.45,1.375)-ish -> z = 2.2 - k(x-7.15)
    k = (2.20 - 1.375) / (9.9 - W2[0])
    def gz(xx): return 2.20 - k * (xx - W2[0])
    ang = math.atan(k); xm = 8.15
    box('Hatch_glacis', (xm, 0, gz(xm) + 0.02), (0.72, 0.62, 0.03), M['super'], rot=(0, ang, 0), bevel=0.012)
    for s in (1, -1):
        for xx in (7.85, 8.45):
            cyl('HatchRailPost', (xx, s * 0.36, gz(xx)), (xx, s * 0.36, gz(xx) + 0.07), 0.012, M['steel'], seg=8)
        cyl('HatchRail', (7.85, s * 0.36, gz(7.85) + 0.07), (8.45, s * 0.36, gz(8.45) + 0.07), 0.014, M['steel'], seg=8)
    # cockpit: stern guard rail panels across the open transom, deck hatches
    zc = cock_z(0.05)
    for y in np.linspace(-1.45, 1.45, 5):
        cyl('SternPost', (0.06, y, zc), (0.06, y, sheer_z(0.06)), 0.022, M['steel'], seg=10)
    for zz in (zc + 0.20, sheer_z(0.06) - 0.01):
        cyl('SternRail', (0.06, -1.62, zz), (0.06, 1.62, zz), 0.022, M['steel'], seg=10)
    for y in (-0.85, 0.85):
        box('CockpitHatch', (0.75, y, cock_z(0.75) + 0.008), (0.55, 0.55, 0.02), M['deck'], bevel=0.008)
    # side access panel on the aft bulwark (master) + exhaust outlet
    for s in (1, -1):
        y = s * (hb_sheer(2.0) + 0.004)
        box('BulwarkPanel_%d' % s, (2.05, y, 1.12), (1.10, 0.008, 0.20), M['hull'], bevel=0.003)
        xo, zo = 2.88, 0.23; yo = s * (side_y(xo, zo) + 0.002)
        cyl('Exhaust_%d' % s, (xo, yo - s * 0.05, zo), (xo, yo + s * 0.012, zo), 0.085, M['jet'], seg=24)
        cyl('ExhaustBore_%d' % s, (xo, yo - s * 0.04, zo), (xo, yo + s * 0.014, zo), 0.062, M['dark'], seg=24)

def build_lettering():
    font = bpy.data.fonts.load(FONT)
    for s in (1, -1):
        for body, size, zb in (('TOMRİS', 0.41, 0.48), ('TCB-1601', 0.32, 0.17)):
            cu = bpy.data.curves.new('txt', 'FONT'); cu.body = body; cu.font = font; cu.size = size
            cu.align_x = 'CENTER'; cu.space_character = 1.06
            ob = bpy.data.objects.new('txt_tmp', cu); BOAT.objects.link(ob)
            x = 1.42; y = side_y(x, zb + 0.12) + 0.004
            ob.location = (x, s * y, zb); ob.rotation_euler = (D2R(90), 0, D2R(180) if s > 0 else 0)
            new = to_mesh(ob, 'Letter_%s_%s' % (body, 'P' if s > 0 else 'S'), M['letter'])
            new.location = ob.location if False else (x, s * y, zb)
            new.rotation_euler = (D2R(90), 0, D2R(180) if s > 0 else 0)

# ----------------------------------------------------------------------------- build boat
build_hull(); build_rubrail(); build_deckhouse(); build_mast(); build_flag()
build_rws(); build_launcher(); build_waterjets(); build_fittings(); build_lettering()
for s, nm in ((1, 'spray_L'), (-1, 'spray_R')):   # bow-chine waterline spray emitters (static DWL)
    x = 8.5; zk = keel_z(x); yc, zc = chine(x); y = yc * (0 - zk) / (zc - zk)
    e = pivot(nm, (x, s * y, 0.0), 0.4); e.rotation_euler = (s * D2R(-60), 0, 0)

root = bpy.data.objects.new('TOMRIS', None); root.empty_display_size = 2; BOAT.objects.link(root)
root.location = PIVOT
for ob in list(BOAT.objects):
    if ob is root or ob.parent is not None: continue
    ob.parent = root; ob.matrix_parent_inverse = Matrix.Translation(PIVOT).inverted()
root.rotation_euler = (0, -TRIM, 0)
root['note'] = 'Static frame: x fwd from transom, z up from DWL, draught 0.7. Rotation = planing trim.'

# ----------------------------------------------------------------------------- sea
def build_sea():
    seg, r0, ratio, rmax = 512, 0.4, 1.0123, 6000.0
    radii = [r0]
    while radii[-1] < rmax: radii.append(radii[-1] * ratio)
    R = np.array(radii); A = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    cx = 6.5
    X = (cx + R[:, None] * np.cos(A)[None, :]).ravel(); Y = (R[:, None] * np.sin(A)[None, :]).ravel()
    co = np.stack([X, Y, np.zeros_like(X)], 1).astype(np.float32)
    nr = len(R); idx = np.arange(nr * seg).reshape(nr, seg)
    a = idx[:-1]; b = idx[1:]; a2 = np.roll(a, -1, 1); b2 = np.roll(b, -1, 1)
    quads = np.stack([a, a2, b2, b], -1).reshape(-1, 4)
    me = bpy.data.meshes.new('Sea')
    me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
    me.loops.add(quads.size); me.loops.foreach_set('vertex_index', quads.ravel().astype(np.int32))
    me.polygons.add(len(quads)); me.polygons.foreach_set('loop_start', np.arange(0, quads.size, 4, dtype=np.int32))
    me.update(); me.validate()
    me.polygons.foreach_set('use_smooth', np.ones(len(quads), dtype=bool))
    ob = bpy.data.objects.new('Sea', me); ENV.objects.link(ob)
    oc = ob.modifiers.new('Ocean', 'OCEAN')
    oc.geometry_mode = 'DISPLACE'; oc.resolution = 14; oc.viewport_resolution = 6
    oc.spatial_size = 24; oc.wind_velocity = 7.0; oc.wave_scale = 0.6; oc.choppiness = 2.0
    oc.wave_alignment = 0.15; oc.wave_direction = D2R(30); oc.depth = 200; oc.random_seed = 7
    oc.use_normals = True; oc.use_foam = True; oc.foam_coverage = 0.25; oc.foam_layer_name = 'foam'
    ob.data.materials.append(sea_material(root))
    return ob

def sea_material(boat_root):
    m = bpy.data.materials.new('sea'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    b.inputs['IOR'].default_value = 1.333; b.inputs['Specular IOR Level'].default_value = 0.5
    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items(): setattr(n, k, v)
        return n
    def math_(op, a, b_=None, clamp=False):
        n = node('ShaderNodeMath', operation=op); n.use_clamp = clamp
        for sock, val in zip(n.inputs, (a, b_)):
            if val is None: continue
            if isinstance(val, (int, float)): sock.default_value = val
            else: L.new(val, sock)
        return n.outputs[0]
    def smooth(v, a, b_):
        n = node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP'); L.new(v, n.inputs['Value'])
        for sock, val in ((n.inputs['From Min'], a), (n.inputs['From Max'], b_)):
            if isinstance(val, (int, float)): sock.default_value = val
            else: L.new(val, sock)
        return n.outputs['Result']
    tc = node('ShaderNodeTexCoord'); tc.object = boat_root
    sep = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    X = math_('ADD', sep.outputs[0], PIVOT[0]); AY = math_('ABSOLUTE', sep.outputs[1])
    # hull half-breadth at the waterline (approx)
    t = math_('MAXIMUM', math_('DIVIDE', math_('SUBTRACT', X, 5.5), 6.2), 0.0)
    hb = math_('MULTIPLY', math_('SUBTRACT', 1.0, math_('POWER', math_('MINIMUM', t, 1.0), 2.0)), 1.68)
    d = math_('SUBTRACT', AY, hb)
    inx = math_('MULTIPLY', smooth(X, -0.4, 0.4), math_('SUBTRACT', 1.0, smooth(X, 11.0, 11.9)))
    band = math_('MULTIPLY', math_('SUBTRACT', 1.0, smooth(d, 0.0, math_('ADD', 0.35, math_('MULTIPLY', smooth(X, 6, 11), 0.9)))), inx)
    band = math_('MULTIPLY', band, math_('ADD', 0.35, math_('MULTIPLY', smooth(X, 4.0, 10.5), 0.65)))
    # stern wake: spreading V behind the transom + jet wash core
    bx = math_('MULTIPLY', math_('MINIMUM', X, 0.0), -1.0)           # distance behind transom
    wl = math_('ADD', 1.6, math_('MULTIPLY', bx, 0.22))
    behind = smooth(math_('MULTIPLY', X, -1.0), -0.2, 0.3)
    edge = math_('SUBTRACT', 1.0, smooth(math_('ABSOLUTE', math_('SUBTRACT', AY, wl)), 0.3, math_('ADD', 0.9, math_('MULTIPLY', bx, 0.06))))
    inside = math_('MULTIPLY', math_('SUBTRACT', 1.0, smooth(math_('SUBTRACT', AY, wl), -0.3, 0.3)), 0.62)
    wake = math_('MULTIPLY', math_('MAXIMUM', edge, inside), behind)
    wake = math_('MULTIPLY', wake, math_('POWER', 2.718, math_('DIVIDE', bx, -26.0)))
    core = math_('MULTIPLY', math_('SUBTRACT', 1.0, smooth(math_('ABSOLUTE', math_('SUBTRACT', AY, 0.62)), 0.2, math_('ADD', 0.7, math_('MULTIPLY', bx, 0.10)))),
                 math_('POWER', 2.718, math_('DIVIDE', bx, -20.0)))
    wake = math_('MAXIMUM', wake, math_('MULTIPLY', core, smooth(math_('MULTIPLY', X, -1.0), -0.2, 0.2)))
    mask = math_('MAXIMUM', band, wake)
    # foam breakup
    nz = node('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.65
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    vor = node('ShaderNodeTexVoronoi', feature='SMOOTH_F1'); vor.inputs['Scale'].default_value = 4.0
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    brk = math_('MULTIPLY', nz.outputs['Fac'], math_('ADD', 0.6, math_('MULTIPLY', vor.outputs['Distance'], 0.8)))
    boatfoam = smooth(math_('ADD', brk, math_('MULTIPLY', mask, 0.8)), 1.0, 1.4)
    attr = node('ShaderNodeAttribute', attribute_name='foam')
    ofoam = smooth(math_('MULTIPLY', attr.outputs['Fac'], math_('ADD', 0.5, nz.outputs['Fac'])), 0.35, 0.9)
    foam = math_('MAXIMUM', boatfoam, math_('MULTIPLY', ofoam, 0.8), clamp=True)
    mix = node('ShaderNodeMix', data_type='RGBA'); L.new(foam, mix.inputs['Factor'])
    mix.inputs['A'].default_value = (0.003, 0.010, 0.015, 1)
    b.inputs['Emission Color'].default_value = (0.010, 0.030, 0.042, 1); b.inputs['Emission Strength'].default_value = 0.0
    b.inputs['Emission Strength'].default_value = 1.0
    ecol = node('ShaderNodeMix', data_type='RGBA'); L.new(foam, ecol.inputs['Factor'])
    ecol.inputs['A'].default_value = (0.004, 0.013, 0.022, 1); ecol.inputs['B'].default_value = (0, 0, 0, 1)
    L.new(ecol.outputs['Result'], b.inputs['Emission Color']); mix.inputs['B'].default_value = (0.80, 0.83, 0.85, 1)
    L.new(mix.outputs['Result'], b.inputs['Base Color'])
    rr = node('ShaderNodeMapRange'); L.new(foam, rr.inputs['Value']); rr.inputs['To Min'].default_value = 0.035; rr.inputs['To Max'].default_value = 0.6
    L.new(rr.outputs['Result'], b.inputs['Roughness'])
    # micro ripples
    tcw = node('ShaderNodeTexCoord')
    rip = node('ShaderNodeTexNoise'); rip.inputs['Scale'].default_value = 5.0; rip.inputs['Detail'].default_value = 8
    L.new(tcw.outputs['Object'], rip.inputs['Vector'])
    bump = node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.04
    L.new(rip.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

build_sea()

# ----------------------------------------------------------------------------- world, sun, cameras, render settings
w = bpy.data.worlds.new('Sky'); scene.world = w; w.use_nodes = True
N = w.node_tree.nodes; Lk = w.node_tree.links
bg = N['Background']; sky = N.new('ShaderNodeTexSky'); sky.name = 'SkyTex'
sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_disc = True
hs = N.new('ShaderNodeHueSaturation'); hs.name = 'SkySat'
Lk.new(sky.outputs['Color'], hs.inputs['Color']); Lk.new(hs.outputs['Color'], bg.inputs['Color'])
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); ENV.objects.link(sun)

def add_cam(name, loc, rot=None, look=None, lens=50):
    cam = bpy.data.objects.new(name, bpy.data.cameras.new(name)); ENV.objects.link(cam)
    cam.location = loc; cam.data.lens = lens; cam.data.sensor_width = 36; cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.clip_start = 0.1; cam.data.clip_end = 20000
    if rot: cam.rotation_euler = rot
    if look: cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return cam

# master_varA fitted camera (camfit.py, yc=15): world frame == trimmed boat
add_cam('CAM_side_match', (5.8872, 15.0, 3.4033 + 4.5 * math.sin(TRIM)), rot=(D2R(90) - 0.1227, 0, D2R(180)), lens=36 * 2414.406 / 2752)
add_cam('CAM_hero_34', (23.5, 10.5, 1.15), look=(6.8, 0.3, 1.75), lens=50)
add_cam('CAM_aerial', (15.5, 19.0, 21.0), look=(6.3, 0.0, 1.0), lens=45)
add_cam('CAM_stern_34', (-12.5, 7.5, 4.4), look=(5.0, 0.0, 1.9), lens=42)

r = scene.render; r.engine = 'BLENDER_EEVEE'; r.resolution_x, r.resolution_y = 1280, 720
scene.eevee.taa_render_samples = 64; scene.eevee.use_raytracing = True
scene.eevee.use_shadows = True; scene.eevee.shadow_ray_count = 2; scene.eevee.shadow_step_count = 8
try: scene.eevee.ray_tracing_options.resolution_scale = '1'
except Exception: pass
r.film_transparent = False
for vt in ('AgX',):
    try: scene.view_settings.view_transform = vt
    except Exception as e: print('view transform', e)
for lk in ('AgX - Medium High Contrast', 'Medium High Contrast'):
    try: scene.view_settings.look = lk; break
    except Exception: pass
print('VIEW', scene.view_settings.view_transform, scene.view_settings.look)
scene.camera = bpy.data.objects['CAM_side_match']

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'tomris.blend'), compress=True)
print('BUILD OK', len(BOAT.objects), 'boat objects')
