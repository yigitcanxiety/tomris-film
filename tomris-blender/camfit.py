# Fits the master_varA camera (pinhole, looking -Y, pitched down) to known hull facts,
# then unprojects measured image pixels to boat coordinates. Pure numpy.
import numpy as np, sys
W, H = 2752, 1536
def basis(p):
    r = np.array([-1.0, 0, 0]); u = np.array([0, -np.sin(p), np.cos(p)]); d = np.array([0, -np.cos(p), -np.sin(p)])
    return r, u, d
def project(cam, P):
    xc, yc, hc, p, f = cam; r, u, d = basis(p); v = np.asarray(P) - [xc, yc, hc]
    return np.array([W/2 + f*(v@r)/(v@d), H/2 - f*(v@u)/(v@d)])
def unproject(cam, X, Y, yplane):
    xc, yc, hc, p, f = cam; r, u, d = basis(p)
    ray = d + (X - W/2)/f*r - (Y - H/2)/f*u
    t = (yplane - yc)/ray[1]; P = np.array([xc, yc, hc]) + t*ray
    return P[0], P[2]
def fit(yc):
    # unknowns xc hc p f zb zs
    def res(q):
        xc, hc, p, f, zb, zs = q; cam = (xc, yc, hc, p, f)
        out = [(H/2 - f*np.tan(p) - 470)]
        out += list(project(cam, [13.0, 0, zb]) - [240, 776])
        out += list(project(cam, [0, 1.72, zs]) - [2422, 945])
        out += list(project(cam, [0.0, 1.62, 0.0]) - [2420, 1075])
        return np.array(out)
    q = np.array([6.0, 3.5, 0.12, 2400, 1.8, 0.8])
    for _ in range(50):
        r0 = res(q); J = np.zeros((len(r0), len(q)))
        for i in range(len(q)):
            dq = np.zeros(len(q)); dq[i] = 1e-5*max(1, abs(q[i])); J[:, i] = (res(q+dq)-r0)/dq[i]
        q = q - np.linalg.lstsq(J, r0, rcond=None)[0]
    return q, res(q)
if __name__ == '__main__':
    for yc in [13, 14, 15, 16, 18]:
        q, r = fit(yc); print(yc, np.round(q, 3), 'focal_mm', round(36*q[3]/W, 1), 'pitch_deg', round(np.degrees(q[2]), 2), 'res', np.round(r, 1))
