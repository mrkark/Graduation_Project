import numpy as np
from clip import Clip2
from clip3 import *
class Clip5(Clip4):
    """parity-outside AND fixed-correspondence signed offset says not clearly inside (d>-margin)"""
    def __init__(s,sk,margin=0.008,tol=0.006):
        super().__init__(sk);s.c2=Clip2(sk);s.margin=margin;s.tol=tol
        s.c2.cl=s.cl     # share cloth meshes (weights/positions modified externally apply to both)
    def check_sev(s,q,t):
        e,dist=Clip4.check_sev(s,q,t,s.tol)
        _,d2=s.c2.check(q,t)
        keep=e&(~s.c2.cov|(d2>-s.margin))     # untracked verts keep parity verdict
        return keep,dist
