# TOMRİS true side profile as line art, from the real model (tomris-blender/tomris.blend), for the opening.
#   python3 tomris-overlays/opening/profile_lines.py        (bpy module; ~1 min)  -> assets/profile.js
# Orthographic view from the port side (bow on the left, like master_varA). Lines = visible silhouette, boundary and
# crease edges (dihedral > CREASE) of every part bigger than MIN_PART, with hidden-line removal by ray casting
# toward the viewer through a BVH of the whole boat. Output: polylines in metres (x to the right = aft, y up = +Z
# above the waterline), grouped by part for staged drawing.
import bpy, bmesh, os, re, json, math, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(HERE, "..", "..", "tomris-blender", "tomris.blend")
OUT = os.path.join(HERE, "assets", "profile.js")
CREASE = math.radians(32)       # feature edge threshold
MIN_PART = 0.07                 # parts smaller than this (m, bbox max) draw no lines (screws, bolts), still occlude
STEP = 0.015                    # visibility sample spacing along an edge (m)
SIMPLIFY = 0.0035               # polyline simplification tolerance (m)
SKIP = re.compile(r"^(WH_|Letter_|Sea$|.*_screw|.*gasket|.*_cable|Mast_weld|PT_cable|Halyard)")
VIEW = Vector((0, 1, 0))        # viewer on the port side (+Y in Blender)

GROUPS = [  # first match wins; order = drawing order in the film
    ("hull", r"^(Hull|RubRail|SternPost|BowEye|Jet_|Exhaust|Fairlead|FuelFiller)"),
    ("house", r"^(Wheelhouse|Door|WS_|Side|Louvre|Wiper|DripRail|RoofRail|Vent|Horn|SideBox|Aft|Glacis)"),
    ("deck", r"^(SternRail|GrabRail|AftGrab|HatchRail|Hatch|CockpitHatch|Cleat|Bulwark)"),
    ("gun", r"@gun_az|^RWS"),
    ("launcher", r"@launcher_el|^L_"),
    ("mast", r"^(Mast|Whip|Yard|Nav|Masthead|GPS|White|Radar|SL_|PT_)|@radar_spin|@eoir_az|^EO_"),
    ("flag", r"@flag_hoist"),
    ("jets", r"@jet_"),
]

if not bpy.data.filepath: bpy.ops.wm.open_mainfile(filepath=os.path.abspath(BLEND))
root = bpy.data.objects["TOMRIS"]
def pivot_of(o):
    while o.parent and o.parent is not root: o = o.parent
    return o.name
def group_of(o):
    key = f"{o.name} @{pivot_of(o)}"
    for g, rx in GROUPS:
        if re.search(rx, key): return g
    return "house"

dg = bpy.context.evaluated_depsgraph_get()
objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render and o.name != "Sea"]
# keep only the boat hierarchy
def under_root(o):
    p = o.parent
    while p:
        if p is root: return True
        p = p.parent
    return False
objs = [o for o in objs if under_root(o)]

verts, tris, meshes = [], [], []
for o in objs:
    ev = o.evaluated_get(dg); me = ev.to_mesh()
    bm = bmesh.new(); bm.from_mesh(me); bm.transform(o.matrix_world); bm.normal_update()
    base = len(verts); verts += [v.co.copy() for v in bm.verts]
    for f in bm.faces:
        vs = [v.index + base for v in f.verts]
        for k in range(1, len(vs) - 1): tris.append((vs[0], vs[k], vs[k + 1]))
    meshes.append((o, bm)); ev.to_mesh_clear()
print(f"{len(objs)} parts, {len(tris)} triangles", flush=True)
bvh = BVHTree.FromPolygons(verts, tris, all_triangles=True, epsilon=0.0)

def visible(p):
    hit = bvh.ray_cast(p + VIEW * 0.004, VIEW, 50.0)
    return hit[0] is None

segs = {}   # group -> list of 2D segments
n_edges = 0
for o, bm in meshes:
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    size = max(max(b[i] for b in bb) - min(b[i] for b in bb) for i in range(3))
    if size < MIN_PART or SKIP.match(o.name): bm.free(); continue
    g = group_of(o); out = segs.setdefault(g, [])
    for e in bm.edges:
        fs = e.link_faces
        if len(fs) == 1: cand = fs[0].normal.dot(VIEW) > -0.05
        elif len(fs) == 2:
            a, b = fs[0].normal, fs[1].normal
            fa, fb = a.dot(VIEW) > 0, b.dot(VIEW) > 0
            cand = (fa != fb) or ((fa or fb) and a.angle(b, 0) > CREASE)
        else: cand = True
        if not cand: continue
        n_edges += 1
        p0, p1 = e.verts[0].co, e.verts[1].co
        if g == "flag": continue   # cloth: outline built below from its projected vertices
        L = (p1 - p0).length; n = max(2, int(L / STEP) + 1)
        run = None
        for i in range(n):
            t = i / (n - 1); p = p0.lerp(p1, t); vis = visible(p)
            if vis and run is None: run = t
            if (not vis or i == n - 1) and run is not None:
                t1 = t if vis else (i - 0.5) / (n - 1)
                if t1 > run:
                    q0, q1 = p0.lerp(p1, run), p0.lerp(p1, t1)
                    out.append(((-q0.x, q0.z), (-q1.x, q1.z)))
                run = None
    if g == "flag":                # top and bottom envelopes per x bin -> one closed outline
        P = [(-v.co.x, v.co.z) for v in bm.verts]
        if P:
            xa, xb = min(p[0] for p in P), max(p[0] for p in P); N = 24; top, bot = [None] * N, [None] * N
            for x, y in P:
                k = min(N - 1, int((x - xa) / (xb - xa + 1e-9) * N))
                top[k] = y if top[k] is None else max(top[k], y); bot[k] = y if bot[k] is None else min(bot[k], y)
            xs_ = [xa + (k + .5) / N * (xb - xa) for k in range(N)]
            T = [(xs_[k], top[k]) for k in range(N) if top[k] is not None]; B = [(xs_[k], bot[k]) for k in range(N) if bot[k] is not None]
            ring = [(xa, B[0][1])] + [(xa, T[0][1])] + T + [(xb, T[-1][1]), (xb, B[-1][1])] + B[::-1] + [(xa, B[0][1])]
            out.extend(zip(ring, ring[1:]))
    bm.free()
print(f"{n_edges} candidate edges", flush=True)

# chain segments into polylines, then simplify (Ramer-Douglas-Peucker)
def chain(S):
    key = lambda p: (round(p[0] * 2000), round(p[1] * 2000))
    adj = {}
    for i, (a, b) in enumerate(S):
        adj.setdefault(key(a), []).append((i, 0)); adj.setdefault(key(b), []).append((i, 1))
    used = [False] * len(S); lines = []
    def walk(i, end):
        pts = [S[i][1 - end], S[i][end]]; used[i] = True
        while True:
            nxt = [(j, k) for j, k in adj.get(key(pts[-1]), []) if not used[j]]
            if len(adj.get(key(pts[-1]), [])) != 2 or not nxt: return pts
            j, k = nxt[0]; used[j] = True; pts.append(S[j][1 - k])
    for i in range(len(S)):
        if used[i]: continue
        fwd = walk(i, 1)
        # extend backwards from the start too
        back = []
        p = fwd[0]
        while True:
            nxt = [(j, k) for j, k in adj.get(key(p), []) if not used[j]]
            if len(adj.get(key(p), [])) != 2 or not nxt: break
            j, k = nxt[0]; used[j] = True; p = S[j][1 - k]; back.append(p)
        lines.append(back[::-1] + fwd)
    return lines
def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]; dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy) or 1e-9
    d = ([abs(dy * (x - x0) - dx * (y - y0)) / L for x, y in pts[1:-1]] if L > 1e-6 else
         [math.hypot(x - x0, y - y0) for x, y in pts[1:-1]])          # closed ring: farthest point
    k = max(range(len(d)), key=d.__getitem__)
    if d[k] > eps: return rdp(pts[:k + 2], eps)[:-1] + rdp(pts[k + 1:], eps)
    return [pts[0], pts[-1]]

res, allp = {}, []
for g, S in segs.items():
    L = [rdp(l, SIMPLIFY) for l in chain(S)]
    L = [l for l in L if sum(math.dist(a, b) for a, b in zip(l, l[1:])) > 0.02]
    res[g] = [[(round(x, 4), round(y, 4)) for x, y in l] for l in L]; allp += [p for l in L for p in l]
xs, ys = [p[0] for p in allp], [p[1] for p in allp]
bbox = [min(xs), min(ys), max(xs), max(ys)]
order = [g for g, _ in GROUPS if g in res]
data = {"source": "tomris-blender/tomris.blend, orthographic port side (bow left), metres; x = -X (aft right), y = Z",
        "bbox": [round(v, 4) for v in bbox], "order": order,
        "groups": {g: res[g] for g in order}}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write("// generated by profile_lines.py from tomris.blend: do not edit\nwindow.TOMRIS_PROFILE = ")
    json.dump(data, f, separators=(",", ":")); f.write(";\n")
print(OUT, {g: (len(res[g]), sum(len(l) for l in res[g])) for g in order}, "bbox", bbox)
