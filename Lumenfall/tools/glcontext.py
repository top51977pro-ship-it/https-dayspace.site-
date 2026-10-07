"""Creates a legacy (compatibility profile) OpenGL context via GLX for headless testing.

Run under Xvfb (xvfb-run). Mesa's llvmpipe exposes GL 4.5 compatibility for legacy
contexts, which matches what Iris feeds `#version 330 compatibility` shaders.
"""
import ctypes
import ctypes.util

_X = ctypes.CDLL(ctypes.util.find_library("X11"))
_GL = ctypes.CDLL("libGL.so.1")

_X.XOpenDisplay.restype = ctypes.c_void_p
_X.XOpenDisplay.argtypes = [ctypes.c_char_p]
_X.XDefaultRootWindow.restype = ctypes.c_ulong
_X.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
_X.XCreateColormap.restype = ctypes.c_ulong
_X.XCreateColormap.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_int]
_X.XCreateWindow.restype = ctypes.c_ulong
_X.XCreateWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint,
                             ctypes.c_uint, ctypes.c_uint, ctypes.c_int, ctypes.c_uint, ctypes.c_void_p,
                             ctypes.c_ulong, ctypes.c_void_p]
_GL.glXChooseVisual.restype = ctypes.c_void_p
_GL.glXChooseVisual.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
_GL.glXCreateContext.restype = ctypes.c_void_p
_GL.glXCreateContext.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
_GL.glXMakeCurrent.restype = ctypes.c_int
_GL.glXMakeCurrent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p]


class _XVisualInfo(ctypes.Structure):
    _fields_ = [("visual", ctypes.c_void_p), ("visualid", ctypes.c_ulong), ("screen", ctypes.c_int),
                ("depth", ctypes.c_int)]


class _XSetWindowAttributes(ctypes.Structure):
    _fields_ = [("background_pixmap", ctypes.c_ulong), ("background_pixel", ctypes.c_ulong),
                ("border_pixmap", ctypes.c_ulong), ("border_pixel", ctypes.c_ulong),
                ("bit_gravity", ctypes.c_int), ("win_gravity", ctypes.c_int),
                ("backing_store", ctypes.c_int), ("backing_planes", ctypes.c_ulong),
                ("backing_pixel", ctypes.c_ulong), ("save_under", ctypes.c_int),
                ("event_mask", ctypes.c_long), ("do_not_propagate_mask", ctypes.c_long),
                ("override_redirect", ctypes.c_int), ("colormap", ctypes.c_ulong),
                ("cursor", ctypes.c_ulong)]


_keep = []


def create_context(width=64, height=64):
    dpy = _X.XOpenDisplay(None)
    if not dpy:
        raise RuntimeError("cannot open X display (run under xvfb-run)")
    GLX_RGBA, GLX_DEPTH_SIZE, GLX_DOUBLEBUFFER = 4, 12, 5
    attrs = (ctypes.c_int * 5)(GLX_RGBA, GLX_DEPTH_SIZE, 24, GLX_DOUBLEBUFFER, 0)
    vi = _GL.glXChooseVisual(dpy, 0, attrs)
    if not vi:
        raise RuntimeError("no GLX visual")
    ctx = _GL.glXCreateContext(dpy, vi, None, 1)
    v = ctypes.cast(vi, ctypes.POINTER(_XVisualInfo)).contents
    root = _X.XDefaultRootWindow(dpy)
    swa = _XSetWindowAttributes()
    swa.colormap = _X.XCreateColormap(dpy, root, v.visual, 0)
    CWColormap = 1 << 13
    win = _X.XCreateWindow(dpy, root, 0, 0, width, height, 0, v.depth, 1, v.visual, CWColormap,
                           ctypes.byref(swa))
    if not _GL.glXMakeCurrent(dpy, win, ctx):
        raise RuntimeError("glXMakeCurrent failed")
    _keep.extend([dpy, ctx, win, swa])
    return dpy, ctx
