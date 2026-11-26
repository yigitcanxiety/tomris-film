# TOMRIS background props -> small GLBs + dusk EEVEE previews.
#   Blender -b -P build_props.py -- [harbour coast target buoy] [--norender]
# Blender frame: +Z up, origin at water level. Exported with +Y up (glTF): Blender (x,y,z) -> glTF (x,z,-y).
# Boat convention (from tomris-blender/build.py): bow = Blender +X = three.js +X, port = Blender +Y = three.js -Z.
import bpy, bmesh, math, random, sys, os, json
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PREV = os.path.join(HERE, 'previews')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = '--norender' not in argv
WANT = [a for a in argv if not a.startswith('--')] or ['harbour', 'coast', 'target', 'buoy']

# ---------------------------------------------------------------- geometry helpers
class Part:
    """Accumulates polygons + per-face material names; becomes one mesh object."""
    def __init__(s, mat=None): s.v, s.f, s.m, s.mat = [], [], [], mat
    def add(s, verts, faces, mat):
        o = len(s.v); s.v += [tuple(p) for p in verts]
        s.f += [tuple(i + o for i in f) for f in faces]; s.m += [mat] * len(faces)

BOXF = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
SIG = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]

def box(p, x0, y0, z0, x1, y1, z1, mat, bottom=False):
    v = [((x0, x1)[sx > 0], (y0, y1)[sy > 0], (z0, z1)[sz > 0]) for sx, sy, sz in SIG]
    p.add(v, BOXF if bottom else BOXF[1:], mat)

def frame(a):
    a = a.normalized(); ref = Vector((1, 0, 0)) if abs(a.z) > 0.9 else Vector((0, 0, 1))
    s = a.cross(ref).normalized(); return s, a.cross(s).normalized()

def beam(p, p0, p1, w, d, mat):
    p0, p1 = Vector(p0), Vector(p1); s, u = frame(p1 - p0)
    v = [(p0 if sz < 0 else p1) + s * sx * w / 2 + u * sy * d / 2 for sx, sy, sz in SIG]
    p.add(v, BOXF, mat)

def frustum(p, p0, p1, r0, r1, mat, seg=10, caps=True):
    p0, p1 = Vector(p0), Vector(p1); s, u = frame(p1 - p0); n = seg
    ring = lambda c, r: [c + (s * math.cos(2 * math.pi * i / n) + u * math.sin(2 * math.pi * i / n)) * r for i in range(n)]
    v = ring(p0, r0) + ring(p1, r1)
    f = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    if caps: f += [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    p.add(v, f, mat)

def cyl(p, p0, p1, r, mat, seg=10, caps=True): frustum(p, p0, p1, r, r, mat, seg, caps)

_ico = bmesh.new(); bmesh.ops.create_icosphere(_ico, subdivisions=1, radius=1.0)
ICO_V = [tuple(v.co) for v in _ico.verts]; ICO_F = [tuple(v.index for v in f.verts) for f in _ico.faces]; _ico.free()
ICO0_V = [(0, -.526, .851), (0, .526, .851), (0, -.526, -.851), (0, .526, -.851), (-.526, .851, 0), (.526, .851, 0),
          (-.526, -.851, 0), (.526, -.851, 0), (.851, 0, -.526), (.851, 0, .526), (-.851, 0, -.526), (-.851, 0, .526)]
ICO0_F = [(1, 0, 9), (0, 1, 11), (1, 9, 5), (1, 5, 4), (1, 4, 11), (0, 11, 6), (0, 6, 7), (0, 7, 9), (9, 7, 8), (9, 8, 5),
          (5, 8, 3), (5, 3, 4), (4, 3, 10), (4, 10, 11), (11, 10, 6), (6, 10, 2), (6, 2, 7), (7, 2, 8), (8, 2, 3), (2, 10, 3)]

def lamp(p, c, r, mat=None, fine=False):
    mat = mat or p.mat
    V, F = (ICO_V, ICO_F) if fine else (ICO0_V, ICO0_F)
    p.add([(c[0] + x * r, c[1] + y * r, c[2] + z * r) for x, y, z in V], F, mat)

# ---------------------------------------------------------------- materials / objects
MATS = {}
def mat(name, col, rough=0.75, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = False
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m; return m

def mk(name, part, coll, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata(part.v, [], part.f); me.update()
    names = list(dict.fromkeys(part.m))
    for n in names: me.materials.append(MATS[n])
    idx = {n: i for i, n in enumerate(names)}
    for poly, n in zip(me.polygons, part.m): poly.material_index = idx[n]
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear()
    c = bpy.data.collections.new('PROP'); bpy.context.scene.collection.children.link(c); return c

# shared lamp materials (strength tuned for AgX; exported as KHR_materials_emissive_strength)
def lamp_mats():
    mat('light_sodium', (0.9, 0.45, 0.12), 0.5, emit=(1.0, 0.42, 0.10), strength=14)
    mat('light_white',  (0.9, 0.9, 0.9),   0.5, emit=(0.80, 0.90, 1.0), strength=16)
    mat('light_red',    (0.6, 0.05, 0.03), 0.5, emit=(1.0, 0.04, 0.02), strength=14)

# ---------------------------------------------------------------- 1. HARBOUR
# Local frame: quay front edge along X at y=0, sea toward -Y (glTF +Z), land toward +Y. Quay top z=3.
QZ = 3.0
def crane(p, lt, x0, ang, trolley_y=None, spreader_z=None):
    """Ship-to-shore gantry crane, rail gauge 30 m, portal 48 m, boom 62 m outreach, A-frame apex ~88 m."""
    S, LND, H = 3.0, 33.0, 48.0; M = 'crane_steel'
    for y in (S, LND):
        box(p, x0 - 13, y - 1.2, QZ, x0 + 13, y + 1.2, QZ + 2.2, M)             # bogies on rail
        for sx in (-9, 9): box(p, x0 + sx - 1, y - 1, QZ + 2, x0 + sx + 1, y + 1, H, M)   # legs
        box(p, x0 - 10, y - 1.2, H - 4, x0 + 10, y + 1.2, H, M)                  # portal cross beam
    box(p, x0 - 10, LND - 1, 14, x0 + 10, LND + 1, 16.5, M)                        # landside lower tie
    for sx in (-9, 9):
        box(p, x0 + sx - .8, S, 14, x0 + sx + .8, LND, 15.6, M)                      # sill beam
        box(p, x0 + sx - 1, S, H - 4, x0 + sx + 1, LND, H, M)                        # portal girder
    HZ = H + 2.0                                                                   # boom / girder level
    for sx in (-4.5, 4.5):
        box(p, x0 + sx - .9, -2, HZ - 2, x0 + sx + .9, 56, HZ + 2, M)               # fixed girder + backreach
    box(p, x0 - 7, 40, HZ + 2, x0 + 7, 54, HZ + 8, 'crane_house')                  # machinery house
    apex_z, apex_y = 88.0, 9.0
    for sx in (-1, 1):
        beam(p, (x0 + sx * 8.5, S, H), (x0 + sx * 4.5, apex_y, apex_z), 1.8, 1.8, M)    # front A-leg
        beam(p, (x0 + sx * 8.5, LND, H), (x0 + sx * 4.5, apex_y, apex_z), 1.8, 1.8, M)  # back A-leg
        beam(p, (x0 + sx * 4.5, apex_y, apex_z), (x0 + sx * 4.5, 55, HZ + 2), .8, .8, M)  # backstay
    box(p, x0 - 6, apex_y - 1.5, apex_z - 1, x0 + 6, apex_y + 1.5, apex_z + 2.5, M)       # apex head
    for z in (66, 76): box(p, x0 - 7, apex_y + 1, z, x0 + 7, apex_y + 2.5, z + 1.2, M)     # A-frame ties
    # seaward boom hinged at (y=-2, z=HZ), angle up from horizontal
    a = math.radians(ang); d = Vector((0, -math.cos(a), math.sin(a))); hinge = Vector((0, -2, HZ)); Lb = 62
    for sx in (-4.5, 4.5):
        o = Vector((x0 + sx, 0, 0)); beam(p, o + hinge, o + hinge + d * Lb, 1.6, 3.6, M)
        for t in (0.5, 0.95):                                                        # forestays
            beam(p, (x0 + sx, apex_y, apex_z), o + hinge + d * Lb * t + Vector((0, 0, 1.6)), .7, .7, M)
    for t in (0.2, 0.45, 0.7, 0.97):
        c = hinge + d * Lb * t; beam(p, (x0 - 5.3, c.y, c.z), (x0 + 5.3, c.y, c.z), 1.0, 1.4, M)
    tip = hinge + d * Lb
    lamp(lt['light_red'], (x0, apex_y, apex_z + 3.4), 0.9)
    lamp(lt['light_red'], (x0, tip.y, tip.z + 2.6), 0.9)
    lamp(lt['light_white'], (x0, 50, HZ - 2.8), 0.8)                                 # backreach flood
    for sx in (-9, 9): lamp(lt['light_sodium'], (x0 + sx, S - 1.8, H - 5), 0.8)       # portal floods
    if ang < 10:                                                                     # working: trolley + spreader
        ty = trolley_y; box(p, x0 - 4, ty - 5, HZ - 4.5, x0 + 4, ty + 5, HZ - 2, 'crane_house')
        box(p, x0 - 1.8, ty - 1, HZ - 8, x0 + 1.8, ty + 3, HZ - 4.5, 'crane_house')    # cab
        for sx in (-2.5, 2.5): beam(p, (x0 + sx, ty, HZ - 4.5), (x0 + sx, ty, spreader_z + 1.5), .35, .35, M)
        box(p, x0 - 6.1, ty - 1.2, spreader_z, x0 + 6.1, ty + 1.2, spreader_z + 1.5, 'crane_house')
        for k in (-1, 1): lamp(lt['light_white'], (x0, ty + k * 4.5, HZ - 5), 0.8)
        lamp(lt['light_white'], (x0, -30, HZ - 2.8), 0.8)
    else:                                                                            # idle: trolley parked
        box(p, x0 - 4, 14, HZ - 4.5, x0 + 4, 24, HZ - 2, 'crane_house')

def ship_hull(p, x0, yc, Lh, B, fb, draft, mat_hull, mat_deck, stern_rake=0.25, bow_rake=0.55):
    T = [0, .015, .05, .1, .2, .4, .6, .72, .8, .86, .91, .95, .98, 1.0]
    sect = []
    for t in T:
        hb = B / 2 * (0.9 + 0.1 * min(1, t / 0.1)) if t < .72 else B / 2 * math.sqrt(max(0.0, 1 - ((t - .72) / .28) ** 2))
        hw = B / 2 * (0.9 + 0.1 * min(1, t / 0.1)) if t < .65 else B / 2 * math.sqrt(max(0.0, 1 - ((t - .65) / .32) ** 2))
        hb, hw = max(hb, .25), max(hw, .2)
        hk = hw * (0.2 if t < .04 or t > .9 else 0.85)
        pts = [(-hb, fb), (-hw, 0), (-hk, -draft), (hk, -draft), (hw, 0), (hb, fb)]
        def X(z): return x0 + t * Lh - (fb - z) * bow_rake * max(0, (t - .86) / .14) + (fb - z) * stern_rake * max(0, (.05 - t) / .05)
        sect.append([(X(z), yc + y, z) for y, z in pts])
    v = [q for s in sect for q in s]; n = 6; f = []
    for i in range(len(T) - 1):
        a, b = i * n, (i + 1) * n
        f += [(a + j, a + j + 1, b + j + 1, b + j) for j in range(n - 1)]
    p.add(v, f, mat_hull)
    deck = [(a * n, a * n + 5, (a + 1) * n + 5, (a + 1) * n) for a in range(len(T) - 1)]
    p.add(v, deck, mat_deck)
    p.add(v, [tuple(range(n)), tuple(range((len(T) - 1) * n, len(T) * n))], mat_hull)  # transom / stem caps

def container_ship(p, lt, x0, yc, rnd):
    Lh, B, fb = 230.0, 32.0, 12.0
    ship_hull(p, x0, yc, Lh, B, fb, 11, 'ship_hull_dark', 'ship_deck')
    dx0, dx1 = x0 + 0.07 * Lh, x0 + 0.13 * Lh
    box(p, dx0, yc - 12, fb, dx1, yc + 12, fb + 34, 'ship_superstructure')            # accommodation
    box(p, dx0 + 2, yc - B / 2, fb + 31, dx1, yc + B / 2, fb + 34.5, 'ship_superstructure')  # bridge wings
    box(p, dx0 - 9, yc - 4, fb, dx0 - 2, yc + 4, fb + 37, 'ship_funnel')               # funnel
    beam(p, (dx1 - 4, yc, fb + 34.5), (dx1 - 4, yc, fb + 44), .5, .5, 'ship_superstructure')
    box(p, x0 + 0.92 * Lh, yc - 6, fb, x0 + 0.95 * Lh, yc + 6, fb + 4, 'ship_superstructure')  # forecastle
    beam(p, (x0 + .955 * Lh, yc, fb), (x0 + .955 * Lh, yc, fb + 14), .5, .5, 'ship_superstructure')
    x = dx1 + 2; cols = ['cont_red', 'cont_blue', 'cont_white', 'cont_grey', 'cont_green', 'cont_orange']
    while x + 13 < x0 + 0.9 * Lh:
        frac = (x - x0) / Lh; top = 6 if frac < .7 else max(2, int(6 - (frac - .7) * 20))
        w = B / 2 * (1 if frac < .75 else max(.45, 1 - (frac - .75) * 3))
        ys = [-w, -w / 3, w / 3, w]
        for k in range(3):
            tiers = max(1, top - rnd.choice([0, 0, 1, 2]))
            box(p, x, yc + ys[k] + .2, fb + 1.5, x + 12.6, yc + ys[k + 1] - .2, fb + 1.5 + tiers * 2.6, rnd.choice(cols))
        x += 13.4
    lamp(lt['light_white'], (dx1 - 4, yc, fb + 45), .7)                                # masthead
    lamp(lt['light_white'], (x0 + .955 * Lh, yc, fb + 14.8), .7)
    for k in range(4): lamp(lt['light_sodium'], (dx0 + 2 + k * 4, yc - 12.4, fb + 8 + k * 6), .6)
    lamp(lt['light_white'], (dx0 + 4, yc - B / 2, fb + 35), .7)

def bulk_ship(p, lt, x0, yc, rnd):
    Lh, B, fb = 180.0, 30.0, 8.0
    ship_hull(p, x0, yc, Lh, B, fb, 10, 'ship_hull_rust', 'ship_deck')
    dx0, dx1 = x0 + 0.04 * Lh, x0 + 0.14 * Lh
    box(p, dx0, yc - 11, fb, dx1, yc + 11, fb + 15, 'ship_superstructure')
    box(p, dx0 + 3, yc - B / 2, fb + 13, dx1, yc + B / 2, fb + 15.5, 'ship_superstructure')
    box(p, dx0 - 1, yc - 3.5, fb + 15, dx0 + 5, yc + 3.5, fb + 24, 'ship_funnel')
    beam(p, (dx1 - 3, yc, fb + 15.5), (dx1 - 3, yc, fb + 25), .5, .5, 'ship_superstructure')
    box(p, x0 + 0.9 * Lh, yc - 8, fb, x0 + 0.96 * Lh, yc + 8, fb + 3, 'ship_superstructure')
    for k in range(5):                                                                 # hatch covers
        hx = dx1 + 6 + k * 23; box(p, hx, yc - 9, fb, hx + 17, yc + 9, fb + 2.2, 'ship_deck_equip')
        if k < 4:                                                                      # deck cranes between hatches
            cx = hx + 20; cyl(p, (cx, yc, fb), (cx, yc, fb + 10), 1.6, 'ship_deck_equip', seg=8)
            box(p, cx - 2, yc - 2, fb + 10, cx + 2, yc + 2, fb + 13, 'ship_deck_equip')
            jd = Vector((math.cos(math.radians(rnd.uniform(-30, 30))), math.sin(math.radians(rnd.uniform(-40, 40))), 0)).normalized()
            el = math.radians(rnd.uniform(25, 55)); jv = Vector((jd.x * math.cos(el), jd.y * math.cos(el), math.sin(el)))
            beam(p, (cx, yc, fb + 12), Vector((cx, yc, fb + 12)) + jv * 24, .9, .9, 'ship_deck_equip')
    lamp(lt['light_white'], (dx1 - 3, yc, fb + 26), .7)
    for k in range(3): lamp(lt['light_sodium'], (dx0 + 2 + k * 6, yc - 11.4, fb + 4 + k * 4), .6)
    lamp(lt['light_white'], (x0 + .5 * Lh, yc - 9, fb + 6), .6)

def gable(p, x0, y0, x1, y1, h, ridge, wall, roof):
    z0 = QZ; ym = (y0 + y1) / 2
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, h), (x1, y0, h), (x1, y1, h), (x0, y1, h),
         (x0, ym, h + ridge), (x1, ym, h + ridge)]
    p.add(v, [(0, 1, 5, 4), (2, 3, 7, 6), (3, 0, 4, 8, 7), (1, 2, 6, 9, 5)], wall)
    p.add(v, [(4, 5, 9, 8), (6, 7, 8, 9)], roof)

def light_mast(p, lt, x, y, h, kind):
    beam(p, (x, y, QZ), (x, y, h), 1.1, 1.1, 'mast_steel')
    box(p, x - 2.6, y - 2.6, h, x + 2.6, y + 2.6, h + .6, 'mast_steel')
    for dx, dy in ((-2.2, 0), (2.2, 0), (0, -2.2), (0, 2.2), (-1.6, -1.6), (1.6, -1.6)):
        lamp(lt[kind], (x + dx, y + dy, h - .5), 0.85)

def build_harbour(coll):
    rnd = random.Random(7)
    mat('crane_steel', (0.16, 0.17, 0.19), 0.6, 0.3); mat('crane_house', (0.30, 0.30, 0.29), 0.7)
    mat('quay_concrete', (0.22, 0.21, 0.20), 0.9); mat('mast_steel', (0.2, 0.2, 0.21), 0.6, 0.3)
    mat('shed_wall', (0.30, 0.29, 0.27), 0.85); mat('shed_roof', (0.18, 0.20, 0.22), 0.6, 0.2)
    mat('silo_concrete', (0.34, 0.33, 0.31), 0.9)
    mat('ship_hull_dark', (0.04, 0.05, 0.08), 0.6); mat('ship_hull_rust', (0.16, 0.06, 0.04), 0.7)
    mat('ship_deck', (0.12, 0.13, 0.12), 0.8); mat('ship_superstructure', (0.55, 0.55, 0.52), 0.6)
    mat('ship_funnel', (0.2, 0.08, 0.05), 0.6); mat('ship_deck_equip', (0.35, 0.3, 0.1), 0.7)
    for n, c in (('cont_red', (0.32, 0.07, 0.04)), ('cont_blue', (0.05, 0.10, 0.25)), ('cont_white', (0.50, 0.50, 0.48)),
                 ('cont_grey', (0.25, 0.25, 0.25)), ('cont_green', (0.06, 0.18, 0.10)), ('cont_orange', (0.50, 0.22, 0.05))):
        mat(n, c, 0.7)
    lamp_mats()
    lt = {k: Part(k) for k in ('light_sodium', 'light_white', 'light_red')}
    ground = Part()
    box(ground, -720, 0, -4, 720, 460, QZ, 'quay_concrete')
    box(ground, -720, -1, QZ - .6, 720, 0, QZ + .3, 'quay_concrete')                 # fender line / cap
    mk('harbour_quay', ground, coll)
    # cranes: (x, boom angle, trolley y, spreader z)
    poses = [(-640, 0, -26, 20), (-560, 0, -12, 34), (-470, 3, -40, 16), (-330, 82, 0, 0),
             (-215, 78, 0, 0), (-95, 42, 0, 0), (55, 84, 0, 0)]
    for i, (x, a, ty, sz) in enumerate(poses):
        c = Part(); crane(c, lt, x, a, ty, sz); mk('crane_%02d' % (i + 1), c, coll)
    # container yard blocks: 7 block-rows (6 boxes wide), bays of 40 ft
    yard = Part(); cols = ['cont_red', 'cont_blue', 'cont_white', 'cont_grey', 'cont_green', 'cont_orange']
    rtg = Part()
    for r in range(7):
        y0 = 55 + r * 38
        base = rnd.choice([2, 3, 3, 4])
        x = -690.0
        while x < 225:
            if rnd.random() > 0.14:
                for g in range(3):
                    tiers = max(1, min(5, base + rnd.choice([-1, 0, 0, 1])))
                    box(yard, x, y0 + g * 5.0, QZ, x + 12.2, y0 + g * 5.0 + 4.8, QZ + tiers * 2.6, rnd.choice(cols))
            x += 12.8
        if r % 2 == 0:                                                                 # rubber-tyred gantries
            gx = rnd.uniform(-600, 150)
            for sx in (0, 1):
                for sy in (0, 1): box(rtg, gx + sx * 26, y0 - 2 + sy * 19, QZ, gx + sx * 26 + 1.2, y0 - 1 + sy * 19, QZ + 24, 'crane_house')
                box(rtg, gx + sx * 26 - .5, y0 - 2.5, QZ + 22, gx + sx * 26 + 1.7, y0 + 18.5, QZ + 25, 'crane_house')
            box(rtg, gx, y0 - 2, QZ + 24, gx + 27.2, y0 + 18, QZ + 25.5, 'crane_house')
            lamp(lt['light_white'], (gx + 13, y0 + 8, QZ + 25.8), .7)
    mk('container_yard', yard, coll); mk('yard_gantries', rtg, coll)
    # sheds, office, silos + conveyor (general cargo / bulk quay, east side)
    b = Part()
    gable(b, 300, 70, 420, 118, QZ + 14, 5, 'shed_wall', 'shed_roof')
    gable(b, 440, 70, 560, 118, QZ + 14, 5, 'shed_wall', 'shed_roof')
    gable(b, 300, 160, 500, 215, QZ + 17, 6, 'shed_wall', 'shed_roof')
    gable(b, -700, 330, -560, 380, QZ + 12, 4, 'shed_wall', 'shed_roof')               # yard workshop
    box(b, 250, 55, QZ, 278, 80, QZ + 24, 'shed_wall')                                 # port office tower
    box(b, 255, 60, QZ + 24, 273, 75, QZ + 27, 'shed_roof')
    for i, (sx, sy) in enumerate(((600, 120), (618, 120), (636, 120), (654, 120), (609, 136), (627, 136), (645, 136))):
        cyl(b, (sx, sy, QZ), (sx, sy, QZ + 42), 8.2, 'silo_concrete', seg=14)
    box(b, 590, 108, QZ + 42, 664, 148, QZ + 49, 'silo_concrete')                      # silo top gallery
    box(b, 612, 104, QZ, 628, 116, QZ + 56, 'silo_concrete')                           # elevator tower
    beam(b, (620, 108, QZ + 50), (620, 14, QZ + 20), 3.2, 3.6, 'silo_concrete')        # conveyor to quay
    box(b, 614, 6, QZ, 626, 20, QZ + 22, 'shed_wall')                                  # ship loader tower
    beam(b, (620, 10, QZ + 21), (620, -26, QZ + 17), 2.4, 2.4, 'crane_steel')         # loader spout boom
    # port control tower (VTS) and two mobile harbour cranes on the general-cargo quay
    cyl(b, (230, 30, QZ), (230, 30, QZ + 44), 3.2, 'silo_concrete', seg=10)
    frustum(b, (230, 30, QZ + 44), (230, 30, QZ + 46), 4.5, 6.5, 'silo_concrete', seg=10)
    cyl(b, (230, 30, QZ + 46), (230, 30, QZ + 50), 6.5, 'shed_roof', seg=10)
    beam(b, (230, 30, QZ + 50), (230, 30, QZ + 58), .5, .5, 'mast_steel')
    for mx, jaz, jel in ((360, 200, 38), (470, 330, 62)):
        box(b, mx - 6, 18, QZ, mx + 6, 30, QZ + 4, 'crane_house')                     # undercarriage
        box(b, mx - 1.8, 22.2, QZ + 4, mx + 1.8, 25.8, QZ + 30, 'crane_house')         # tower
        box(b, mx - 4, 20, QZ + 26, mx + 4, 28, QZ + 31, 'crane_house')               # machinery
        jv = Vector((math.cos(math.radians(jaz)) * math.cos(math.radians(jel)), math.sin(math.radians(jaz)) * math.cos(math.radians(jel)), math.sin(math.radians(jel))))
        beam(b, (mx, 24, QZ + 28), Vector((mx, 24, QZ + 28)) + jv * 48, 1.8, 1.8, 'crane_steel')
        tip = Vector((mx, 24, QZ + 28)) + jv * 48
        beam(b, (mx, 24, QZ + 31), (mx, 24, QZ + 40), 1.0, 1.0, 'crane_steel')        # mast + guy to tip
        beam(b, (mx, 24, QZ + 40), tip, .4, .4, 'crane_steel')
        lamp(lt['light_red'], tuple(tip + Vector((0, 0, 1.2))), .8); lamp(lt['light_white'], (mx, 21, QZ + 25), .7)
    lamp(lt['light_red'], (230, 30, QZ + 58.8), .8)
    for k in range(6): lamp(lt['light_white'], (230 + 6.6 * math.cos(k), 30 + 6.6 * math.sin(k), QZ + 48), .5)
    mk('harbour_buildings', b, coll)
    for x0, x1, y in ((300, 420, 69.5), (440, 560, 69.5), (300, 500, 159.5), (-700, -560, 329.5)):
        for k in range(int((x1 - x0) // 24)): lamp(lt['light_sodium'], (x0 + 12 + k * 24, y, QZ + 7), .6)
    for k in range(9): lamp(lt['light_white' if k % 4 == 0 else 'light_sodium'], (-640 + k * 100, 42 + (k % 3) * 76, QZ + 8), .6)
    for k in range(70):                                                                # scattered low work lights (yard, gates, vehicles)
        x, y = rnd.uniform(-700, 700), rnd.uniform(25, 440)
        lamp(lt['light_white' if rnd.random() < 0.3 else 'light_sodium'], (x, y, QZ + rnd.uniform(4, 16)), .55)
    for k in range(4): lamp(lt['light_sodium'], (264, 54.5, QZ + 4 + k * 5), .8)
    lamp(lt['light_red'], (620, 110, QZ + 57.5), .9); lamp(lt['light_red'], (264, 67, QZ + 28), .8)
    # light masts + quay lamps
    masts = Part()
    for i, (x, y) in enumerate([(-640, 48), (-470, 48), (-300, 48), (-130, 48), (40, 48), (200, 48),
                                (-560, 200), (-360, 200), (-160, 200), (60, 200), (360, 140), (520, 140), (-640, 330)]):
        light_mast(masts, lt, x, y, QZ + 35, 'light_white' if i in (2, 7, 11) else 'light_sodium')
    for i in range(32):
        x = -690 + i * 44.5
        if 260 < x < 300 or (-660 < x < -420) and i % 2: continue
        beam(masts, (x, 9, QZ), (x, 9, QZ + 12), .4, .4, 'mast_steel')
        lamp(lt['light_sodium' if i % 3 else 'light_white'], (x, 8.2, QZ + 12), .7)
    mk('light_masts', masts, coll)
    sh = Part(); container_ship(sh, lt, -660, -18.5, rnd); bulk_ship(sh, lt, 300, -17.5, rnd); mk('moored_ships', sh, coll)
    for k, prt in lt.items(): mk('lamps_' + k.split('_')[1], prt, coll)

# ---------------------------------------------------------------- 2. COAST
# Arcs centred on the boat start; az 180 deg = astern (Blender -X = three.js -X). Port = +Y (az 90).
def build_coast(coll):
    mat('coast_hill_near', (0.06, 0.07, 0.06), 0.95); mat('coast_hill_mid', (0.07, 0.08, 0.09), 0.95)
    mat('coast_hill_far', (0.09, 0.10, 0.12), 0.95); mat('coast_island', (0.08, 0.09, 0.10), 0.95)
    mat('light_village', (0.9, 0.5, 0.2), 0.5, emit=(1.0, 0.45, 0.12), strength=14)
    mat('light_white', (0.9, 0.9, 0.9), 0.5, emit=(0.80, 0.90, 1.0), strength=16)
    lt = {k: Part(k) for k in ('light_village', 'light_white')}

    def height_fn(r0, span, height, seed, gaps):
        rnd = random.Random(seed); arc = r0 * math.radians(2 * span)
        waves = [(arc / wl, rnd.uniform(0, 6.283), a) for wl, a in ((9000, .32), (4200, .26), (1800, .13), (700, .04))]
        def h(u):
            e = min(1.0, u / 0.1, (1 - u) / 0.1); e = e * e * (3 - 2 * e)              # headlands dip into the sea
            for gc, gw in gaps:                                                       # bays / gaps between headlands
                g = min(1.0, abs(u - gc) / gw); e *= 0.12 + 0.88 * g * g * (3 - 2 * g)
            s = sum(a * math.sin(2 * math.pi * f * u + ph) for f, ph, a in waves)
            return max(0.0, height * e * (0.58 + s))
        return h

    def ridge(name, matn, r0, span, height, depth, seg, seed, gaps, center=180.0):
        h = height_fn(r0, span, height, seed, gaps); rr = random.Random(seed + 1); p = Part()
        rows = [(-depth, None), (-0.45 * depth, 0.5), (0.0, 1.0), (0.5 * depth, 0.55)]
        v = []
        for i in range(seg + 1):
            u = i / seg; az = math.radians(center + (2 * u - 1) * span); hu = h(u)
            jit = depth * 0.25 * math.sin(u * 37.0 + seed)                            # crest wobble
            for dr, hf in rows:
                r = r0 + dr + (jit if hf else 0); z = -4.0 if hf is None else hu * hf
                v.append((r * math.cos(az), r * math.sin(az), z))
        n = len(rows); f = [(i * n + j, i * n + j + 1, (i + 1) * n + j + 1, (i + 1) * n + j) for i in range(seg) for j in range(n - 1)]
        p.add(v, f, matn); mk(name, p, coll, smooth=True); return h

    hn = ridge('coast_ridge_near', 'coast_hill_near', 3600, 110, 55, 700, 400, 11, [(0.5, 0.06), (0.2, 0.03), (0.8, 0.04)])
    hm = ridge('coast_ridge_mid', 'coast_hill_mid', 6500, 125, 210, 1100, 440, 23, [(0.28, 0.04), (0.74, 0.03)])
    ridge('coast_ridge_far', 'coast_hill_far', 11000, 140, 480, 1800, 480, 37, [(0.15, 0.03)])
    # island off the port bow (setup A "faint island on the left")
    isl = Part(); cx, cy = 14000 * math.cos(math.radians(25)), 14000 * math.sin(math.radians(25))
    R, NA, rings = 1600.0, 48, [0.0, 0.35, 0.7, 1.0, 1.12]; v = []; rnd = random.Random(5)
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    for i, rf in enumerate(rings):
        for k in range(NA):
            t = 2 * math.pi * k / NA
            bump = 1 + .25 * math.sin(2 * t + ph[0]) + .15 * math.sin(5 * t + ph[1])
            z = -4 if rf > 1 else 170 * (1 - rf ** 2) ** 0.8 * (bump if rf > 0 else 1.2) * (1 + .4 * math.cos(t - 1))
            v.append((cx + R * rf * math.cos(t) * 1.6, cy + R * rf * math.sin(t) * 0.7, z))
    f = [(i * NA + k, i * NA + (k + 1) % NA, (i + 1) * NA + (k + 1) % NA, (i + 1) * NA + k) for i in range(len(rings) - 1) for k in range(NA)]
    isl.add(v, f, 'coast_island'); mk('coast_island', isl, coll, smooth=True)
    # village lights: clusters at the foot of the near ridge, sparse on the mid ridge
    rnd = random.Random(99)
    for (h, r0, depth, span, nclus, size) in ((hn, 3600, 700, 110, 12, 1.5), (hm, 6500, 1100, 125, 7, 2.2)):
        for c in range(nclus):
            u0 = rnd.uniform(0.12, 0.88)
            if 0.44 < u0 < 0.56: u0 += 0.12                                          # keep the harbour gap dark
            for k in range(rnd.randint(5, 16)):
                u = min(.97, max(.03, u0 + rnd.gauss(0, 0.006))); hu = h(u)
                if hu < 6: continue
                q = rnd.uniform(0.04, 0.9) ** 1.5; az = math.radians(180 + (2 * u - 1) * span)
                r = r0 - depth + q * 0.55 * depth; z = -4 + q * (hu * 0.5 + 4) + 3
                lamp(lt['light_white' if rnd.random() < 0.18 else 'light_village'], (r * math.cos(az), r * math.sin(az), z), size)
    for k, prt in lt.items(): mk('lamps_' + k.split('_')[1], prt, coll)

# ---------------------------------------------------------------- 3. TARGET (anonymous ~30 m patrol craft)
# Bow +X (same as TOMRIS), port +Y, waterline z=0.
def build_target(coll):
    mat('target_hull', (0.30, 0.31, 0.32), 0.6); mat('target_superstructure', (0.36, 0.37, 0.38), 0.6)
    mat('target_deck', (0.18, 0.19, 0.19), 0.8); mat('target_glass', (0.02, 0.025, 0.03), 0.1)
    mat('target_exhaust', (0.20, 0.20, 0.21), 0.7); mat('target_equipment', (0.24, 0.25, 0.26), 0.6)
    mat('target_rubber', (0.04, 0.04, 0.04), 0.9)
    p = Part(); Lh, B, d = 30.0, 6.6, 1.7
    T = [0, .02, .08, .2, .35, .5, .62, .72, .8, .87, .92, .96, .99, 1.0]; sect = []
    for t in T:
        fb = 2.2 + 1.3 * max(0, (t - .45) / .55) ** 1.6                                # sheer rises to the bow
        hb = B / 2 * (0.93 + .07 * min(1, t / .12)) if t < .6 else B / 2 * math.sqrt(max(0, 1 - ((t - .6) / .4) ** 2.2))
        hb = max(hb, .12); hc = hb * (.92 if t < .7 else .8); kz = -d * (.85 + .15 * min(1, t / .3)) if t < .8 else -d * (1 - (t - .8) * 2.5)
        pts = [(-hb, fb), (-hc, .25), (0, kz), (hc, .25), (hb, fb)]
        def X(z, t=t, fb=fb): return t * Lh - (fb - z) * 0.9 * max(0, (t - .87) / .13)
        sect.append([(X(z), y, z) for y, z in pts])
    v = [q for s in sect for q in s]; n = 5; f = []
    for i in range(len(T) - 1):
        a, b = i * n, (i + 1) * n; f += [(a + j, a + j + 1, b + j + 1, b + j) for j in range(n - 1)]
    p.add(v, f, 'target_hull')
    p.add(v, [(a * n, a * n + 4, (a + 1) * n + 4, (a + 1) * n) for a in range(len(T) - 1)], 'target_deck')
    p.add(v, [tuple(range(n))], 'target_hull')
    # bulwark rub-strake (dark) along the sheer
    for i in range(1, len(T) - 2):
        for s in (0, 4):
            a, b = Vector(sect[i][s]), Vector(sect[i + 1][s]); beam(p, a - Vector((0, 0, .25)), b - Vector((0, 0, .25)), .25, .2, 'target_rubber')
    DZ = 2.5                                                                          # deck height at superstructure
    box(p, 8.5, -2.6, DZ, 19.5, 2.6, DZ + 2.4, 'target_superstructure')               # main deckhouse
    bv = [(13.0, -2.4, DZ + 2.4), (19.0, -2.4, DZ + 2.4), (19.0, 2.4, DZ + 2.4), (13.0, 2.4, DZ + 2.4),
          (13.0, -2.2, DZ + 4.7), (17.6, -2.2, DZ + 4.7), (17.6, 2.2, DZ + 4.7), (13.0, 2.2, DZ + 4.7)]
    p.add(bv, BOXF, 'target_superstructure')                                          # bridge, raked front
    gv = [(19.05, -2.35, DZ + 3.0), (19.05, 2.35, DZ + 3.0), (17.95, 2.25, DZ + 4.3), (17.95, -2.25, DZ + 4.3)]
    p.add(gv, [(0, 1, 2, 3)], 'target_glass')
    for s in (-1, 1): box(p, 14.2, s * 2.45 - .03, DZ + 3.1, 18.3, s * 2.45 + .03, DZ + 4.1, 'target_glass')
    box(p, 12.2, -3.2, DZ + 4.0, 13.4, 3.2, DZ + 4.25, 'target_superstructure')        # bridge wings
    # mast: raked pole + yard + radar + small dome
    beam(p, (15.0, 0, DZ + 4.7), (14.4, 0, DZ + 10.5), .3, .3, 'target_equipment')
    beam(p, (14.7, -1.6, DZ + 8.2), (14.7, 1.6, DZ + 8.2), .15, .15, 'target_equipment')
    box(p, 15.4, -.25, DZ + 4.7, 16.2, .25, DZ + 6.2, 'target_equipment')
    box(p, 15.6, -1.9, DZ + 6.2, 16.0, 1.9, DZ + 6.5, 'target_equipment')            # radar array
    cyl(p, (13.6, 0, DZ + 4.7), (13.6, 0, DZ + 5.5), .55, 'target_equipment', seg=10)
    # funnel / exhaust (hot in IR) aft of deckhouse
    fv = [(9.0, -.75, DZ + 2.4), (10.6, -.75, DZ + 2.4), (10.6, .75, DZ + 2.4), (9.0, .75, DZ + 2.4),
          (8.6, -.6, DZ + 4.3), (9.8, -.6, DZ + 4.3), (9.8, .6, DZ + 4.3), (8.6, .6, DZ + 4.3)]
    p.add(fv, BOXF, 'target_exhaust')                                                 # whole funnel = hot in IR
    box(p, 8.65, -.45, DZ + 4.3, 9.75, .45, DZ + 4.45, 'target_exhaust')
    for s in (-1, 1): box(p, .2, s * 2.6 - .3, .6, .5, s * 2.6 + .3, 1.2, 'target_exhaust')  # transom exhaust ports
    box(p, 7.6, -2.0, DZ, 8.6, 2.0, DZ + 2.4, 'target_superstructure')                # aft deckhouse step
    # generic bow mount (anonymous, no specific weapon)
    cyl(p, (23.0, 0, 2.9), (23.0, 0, 3.6), .9, 'target_equipment', seg=12)
    box(p, 22.4, -.7, 3.6, 23.8, .7, 4.4, 'target_equipment')
    beam(p, (23.6, 0, 4.0), (26.0, 0, 4.15), .18, .18, 'target_equipment')
    # aft deck: RHIB on cradle + davit, life-raft canisters
    cyl(p, (2.0, 1.5, 2.6), (6.6, 1.5, 2.6), .45, 'target_rubber', seg=8)
    cyl(p, (2.0, 2.5, 2.6), (6.6, 2.5, 2.6), .45, 'target_rubber', seg=8)
    box(p, 2.2, 1.6, 2.3, 6.4, 2.4, 2.9, 'target_equipment')
    beam(p, (5.0, -1.0, 2.3), (5.0, -1.0, 5.2), .25, .25, 'target_equipment'); beam(p, (5.0, -1.0, 5.2), (4.6, 1.8, 5.2), .2, .2, 'target_equipment')
    for x in (9.6, 10.9): cyl(p, (x, -2.3, DZ + 2.75), (x + .9, -2.3, DZ + 2.75), .3, 'target_equipment', seg=8)
    mk('target_vessel', p, coll)

# ---------------------------------------------------------------- 4. BUOY (IALA region A lateral pillar buoys)
def build_buoy(coll):
    mat('buoy_red', (0.55, 0.03, 0.02), 0.55); mat('buoy_green', (0.02, 0.28, 0.07), 0.55)
    mat('buoy_dark', (0.04, 0.04, 0.04), 0.8); mat('buoy_white', (0.7, 0.7, 0.7), 0.4)
    mat('light_buoy_red', (0.6, 0.05, 0.03), 0.3, emit=(1.0, 0.05, 0.02), strength=6)
    mat('light_buoy_green', (0.05, 0.6, 0.2), 0.3, emit=(0.05, 1.0, 0.25), strength=6)
    obs = []
    for name, col, lmat, top in (('buoy_port_red', 'buoy_red', 'light_buoy_red', 'can'),
                                 ('buoy_starboard_green', 'buoy_green', 'light_buoy_green', 'cone')):
        p = Part(); S = 14
        cyl(p, (0, 0, -3.4), (0, 0, -1.1), .18, 'buoy_dark', seg=8)                   # tail tube
        cyl(p, (0, 0, -3.8), (0, 0, -3.4), .45, 'buoy_dark', seg=8)                   # counterweight
        frustum(p, (0, 0, -1.1), (0, 0, -.6), .6, 1.25, col, seg=S)
        cyl(p, (0, 0, -.6), (0, 0, .55), 1.25, col, seg=S)
        frustum(p, (0, 0, .55), (0, 0, .8), 1.25, .95, col, seg=S)
        cyl(p, (0, 0, .05), (0, 0, .35), 1.34, 'buoy_dark', seg=S)                    # fender ring
        cyl(p, (0, 0, .8), (0, 0, 2.65), .38, col, seg=10)                             # day-mark body
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):                            # lattice legs
            beam(p, (sx * .72, sy * .72, .8), (sx * .36, sy * .36, 3.55), .09, .09, col)
        for z, r in ((1.7, .58), (2.6, .47), (3.5, .36)):                              # lattice rings + platform
            for a, b in (((1, 1), (-1, 1)), ((-1, 1), (-1, -1)), ((-1, -1), (1, -1)), ((1, -1), (1, 1))):
                beam(p, (a[0] * r, a[1] * r, z), (b[0] * r, b[1] * r, z), .07, .07, col)
        cyl(p, (0, 0, 3.5), (0, 0, 3.58), .55, col, seg=10)                            # platform
        cyl(p, (0, 0, 1.2), (0, 0, 1.45), .4, 'buoy_white', seg=10)                    # retro-reflective band
        for a0, a1, w, dd in (((-.3, 0), (.3, 0), .02, .5), ((0, -.3), (0, .3), .02, .5), ((-.3, 0), (.3, 0), .6, .02)):
            beam(p, (a0[0], a0[1], 3.05), (a1[0], a1[1], 3.05), w, dd, 'buoy_white')  # octahedral radar reflector
        cyl(p, (0, 0, 3.58), (0, 0, 3.72), .16, 'buoy_dark', seg=10)                   # lantern base
        cyl(p, (0, 0, 3.72), (0, 0, 3.96), .13, lmat, seg=10)                         # lens (emissive)
        frustum(p, (0, 0, 3.96), (0, 0, 4.04), .16, .06, 'buoy_dark', seg=10)
        beam(p, (.3, 0, 3.58), (.3, 0, 4.25), .05, .05, col)                           # topmark post
        if top == 'can': cyl(p, (.3, 0, 4.25), (.3, 0, 4.75), .2, col, seg=10)
        else: frustum(p, (.3, 0, 4.25), (.3, 0, 4.8), .25, .01, col, seg=10)
        obs.append(mk(name, p, coll))
    return obs

# ---------------------------------------------------------------- export / stats / preview
def tri_count(objs):
    n = 0
    for o in objs:
        me = o.data; me.calc_loop_triangles(); n += len(me.loop_triangles)
    return n

def export(name, coll):
    objs = list(coll.objects); bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(HERE, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_lights=False, export_cameras=False, export_animations=False)
    lo = [1e9] * 3; hi = [-1e9] * 3
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co; g = (w.x, w.z, -w.y)
            lo = [min(a, b) for a, b in zip(lo, g)]; hi = [max(a, b) for a, b in zip(hi, g)]
    st = {'file': name + '.glb', 'bytes': os.path.getsize(path), 'triangles': tri_count(objs),
          'bbox_gltf_min': [round(x, 1) for x in lo], 'bbox_gltf_max': [round(x, 1) for x in hi],
          'objects': {o.name: tri_count([o]) for o in objs},
          'materials': sorted({m.name for o in objs for m in o.data.materials}),
          'emissive': sorted({m.name for o in objs for m in o.data.materials if m.name.startswith('light_')})}
    print('PROPSTAT', json.dumps(st)); return st

def dusk_world(sun_dir_az, sun_el=1.5, haze=None):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('dusk'); sc.world = w; w.use_nodes = True; N = w.node_tree.nodes; Lk = w.node_tree.links
    bg = N['Background']; tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ')
    mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.03; mr.inputs['From Max'].default_value = 0.55
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (0.03, 0.035, 0.05, 1); e[1].position = 1.0; e[1].color = (0.02, 0.04, 0.10, 1)
    for pos, c in ((0.05, (1.0, 0.42, 0.14)), (0.12, (0.75, 0.38, 0.30)), (0.3, (0.25, 0.22, 0.38)), (0.6, (0.07, 0.10, 0.25))):
        el = e.new(pos); el.color = (*c, 1)
    # warm glow toward the sun azimuth
    dot = N.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    sd = Vector((math.cos(math.radians(sun_dir_az)), math.sin(math.radians(sun_dir_az)), 0.03)).normalized()
    dot.inputs[1].default_value = sd
    pw = N.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 14.0; pw.use_clamp = True
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'ADD'
    Lk.new(tc.outputs['Generated'], sep.inputs[0]); Lk.new(sep.outputs['Z'], mr.inputs['Value'])
    Lk.new(mr.outputs['Result'], ramp.inputs['Fac'])
    Lk.new(tc.outputs['Generated'], dot.inputs[0]); Lk.new(dot.outputs['Value'], pw.inputs[0])
    Lk.new(pw.outputs[0], mix.inputs['Factor']); Lk.new(ramp.outputs['Color'], mix.inputs[6])
    mix.inputs[7].default_value = (1.4, 0.55, 0.15, 1)
    Lk.new(mix.outputs[2], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.45
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 0.5; sun.color = (1.0, 0.55, 0.3); sun.angle = math.radians(1)
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    sv = Vector((math.cos(math.radians(sun_dir_az)), math.sin(math.radians(sun_dir_az)), math.tan(math.radians(sun_el))))
    so.rotation_euler = (-sv).to_track_quat('-Z', 'Y').to_euler()
    # dark glossy sea
    me = bpy.data.meshes.new('sea'); R = 40000
    me.from_pydata([(-R, -R, 0), (R, -R, 0), (R, R, 0), (-R, R, 0)], [], [(0, 1, 2, 3)])
    sea = bpy.data.objects.new('sea', me); sc.collection.objects.link(sea)
    m = bpy.data.materials.new('sea'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.01, 0.015, 0.022, 1); b.inputs['Roughness'].default_value = 0.12
    me.materials.append(m)
    if haze:                                                                          # cheap distance haze in preview only
        vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = haze
        vol.inputs['Color'].default_value = (0.9, 0.6, 0.5, 1)
        Lk.new(vol.outputs[0], N['World Output'].inputs['Volume'])
    sc.eevee.taa_render_samples = 24
    if hasattr(sc.eevee, 'use_raytracing'): sc.eevee.use_raytracing = True
    if hasattr(sc.eevee, 'volumetric_end'): sc.eevee.volumetric_end = 12000; sc.eevee.volumetric_start = 50

def fake_haze(cam, k=5000.0, col=(0.42, 0.22, 0.14)):
    # preview only (after export): stand-in for the engine's distance fog, per material by nearest user distance
    done = set()
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name == 'sea': continue
        vs = o.data.vertices; st = max(1, len(vs) // 200)
        d = min((o.matrix_world @ vs[i].co - Vector(cam)).length for i in range(0, len(vs), st))
        f = 1 - math.exp(-d / k)
        for m in o.data.materials:
            if m.name in done or m.name.startswith('light_'): continue
            done.add(m.name); b = m.node_tree.nodes['Principled BSDF']
            bc = b.inputs['Base Color'].default_value; b.inputs['Base Color'].default_value = (*[x * (1 - f) for x in bc[:3]], 1)
            b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = f

def render(cams, res=(1440, 602)):
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    for fname, loc, look, lens in cams:
        cd = bpy.data.cameras.new(fname); cd.lens = lens; cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36
        cd.clip_start = 0.5; cd.clip_end = 40000
        co = bpy.data.objects.new(fname, cd); sc.collection.objects.link(co); co.location = loc
        co.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.camera = co; sc.render.filepath = os.path.join(PREV, fname + '.png')
        bpy.ops.render.render(write_still=True); print('RENDERED', fname)

STATS_PATH = os.path.join(HERE, 'props_stats.json')
stats = json.load(open(STATS_PATH)) if os.path.exists(STATS_PATH) else {}

for name in WANT:
    coll = reset()
    if name == 'harbour':
        build_harbour(coll); stats[name] = export(name, coll)
        if RENDER:
            dusk_world(90, 1.5)                                          # sun behind the port (land side)
            render([('harbour_close', (-1150, -650, 90), (-300, 80, 40), 35),
                    ('harbour_detail', (-380, -330, 30), (-560, 0, 40), 35)])
            fake_haze((250, -2100, 22)); render([('harbour', (250, -2100, 22), (-120, 150, 45), 85)])
    elif name == 'coast':
        build_coast(coll); stats[name] = export(name, coll)
        if RENDER:
            dusk_world(180, 1.0); fake_haze((0, 0, 15))
            render([('coast', (0, 0, 15), (-5000, 0, 60), 24),
                    ('coast_port', (0, 0, 15), (3000, 5000, 60), 24),
                    ('coast_tele', (0, 0, 15), (-4000, -2500, 120), 85)])
    elif name == 'target':
        build_target(coll); stats[name] = export(name, coll)
        if RENDER:
            dusk_world(200, -3.0)
            render([('target', (-12, -28, 9), (15, 0, 2.5), 35),
                    ('target_far', (-400, -2600, 6), (15, 0, 3), 400)])
            # crude white-hot EO/IR look: everything emissive by assumed temperature, black-ish world
            heat = {'target_exhaust': 4.0, 'target_hull': .22, 'target_superstructure': .3, 'target_deck': .25,
                    'target_glass': .06, 'target_equipment': .35, 'target_rubber': .15, 'sea': .03}
            for m in bpy.data.materials:
                b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0, 0, 0, 1)
                b.inputs['Emission Color'].default_value = (1, 1, 1, 1); b.inputs['Emission Strength'].default_value = heat.get(m.name, 0)
            bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.04
            bpy.data.objects['sun'].data.energy = 0
            render([('target_ir', (-400, -2600, 6), (15, 0, 3), 400)])
    elif name == 'buoy':
        obs = build_buoy(coll); stats[name] = export(name, coll)
        if RENDER:
            obs[0].location.x = -2.2; obs[1].location.x = 2.2
            dusk_world(150, 0.5)
            render([('buoy', (7, -22, 3.0), (0, 0, 2.2), 50)])
json.dump(stats, open(STATS_PATH, 'w'), indent=1)
print('DONE', WANT)
