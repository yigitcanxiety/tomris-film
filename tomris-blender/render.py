# Render test stills from tomris.blend.
#   Blender -b tomris.blend -P render.py -- [final] [shot ...]
# shots: side_match hero_34_sunset aerial stern_34   (default: all)
import bpy, sys, os, math, time

HERE = os.path.dirname(bpy.data.filepath)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
FINAL = 'final' in argv
SHOTS = {
    # cam, sun elevation, sun dir (x,y) in world, sky strength, sky saturation, exposure, haze(aerosol)
    'side_match':     dict(cam='CAM_side_match', el=32, dir=(0.55, 0.65), sky=0.30, sat=0.55, exp=-2.75, aero=4.0, look='AgX - Base Contrast'),
    'hero_34_sunset': dict(cam='CAM_hero_34', el=1.8, dir=(-0.95, 0.32), sky=0.40, sat=1.45, exp=0.6, aero=2.5, look='AgX - Medium High Contrast'),
    'aerial':         dict(cam='CAM_aerial', el=24, dir=(0.75, 0.55), sky=0.32, sat=0.9, exp=-1.3, aero=1.4, look='AgX - Medium High Contrast'),
    'stern_34':       dict(cam='CAM_stern_34', el=-1.5, dir=(0.25, -0.95), sky=0.55, sat=0.7, exp=1.2, aero=1.2, look='AgX - Medium High Contrast'),
}
todo = [a for a in argv if a in SHOTS] or list(SHOTS)
sc = bpy.context.scene; w = sc.world
sky = w.node_tree.nodes['SkyTex']; sat = w.node_tree.nodes['SkySat']; bg = w.node_tree.nodes['Background']
sun = bpy.data.objects.get('Sun')
if sun: sun.data.energy = 0.0            # sun comes from the sky texture (EEVEE world sun extraction)
w.sun_threshold = 1.0; w.sun_angle = math.radians(1.0); w.use_sun_shadow = True
sc.render.resolution_x, sc.render.resolution_y = (1920, 1080) if FINAL else (1280, 720)
sc.eevee.taa_render_samples = 96 if FINAL else 48
os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)
for name in todo:
    S = SHOTS[name]
    sc.camera = bpy.data.objects[S['cam']]
    sky.sun_elevation = math.radians(S['el']); sky.sun_rotation = math.atan2(S['dir'][0], S['dir'][1])
    sky.aerosol_density = S['aero']; sky.sun_intensity = 1.0
    bg.inputs['Strength'].default_value = S['sky']; sat.inputs['Saturation'].default_value = S['sat']
    sc.view_settings.exposure = S['exp']
    try: sc.view_settings.look = S['look']
    except Exception: pass
    sc.render.filepath = os.path.join(HERE, 'renders', name + ('' if FINAL else '_test') + '.png')
    t = time.time(); bpy.ops.render.render(write_still=True)
    print('RENDERED %s %.1fs -> %s' % (name, time.time() - t, sc.render.filepath), flush=True)
