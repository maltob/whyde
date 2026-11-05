export const TURTLE_SHIM_PY = `"""
Browser-compatible Python Turtle graphics module for WebAssembly / Pyodide.
Emits SVG vector graphics and sends rendered plots directly to the IDE's visual canvas.
"""

import math
import sys

_screen_instance = None
_turtle_instance = None

class Screen:
    def __init__(self, width=600, height=500):
        self.width = width
        self.height = height
        self.bg_color = "white"
        self._turtles = []
        global _screen_instance
        _screen_instance = self

    def bgcolor(self, color=None):
        if color is not None:
            self.bg_color = str(color)
        return self.bg_color

    def setup(self, width=600, height=500, *args, **kwargs):
        self.width = width
        self.height = height

    def reset(self):
        self._turtles.clear()

    def clearscreen(self):
        self.reset()

    def tracer(self, *args, **kwargs):
        pass

    def update(self):
        self._flush_svg()

    def mainloop(self):
        self._flush_svg()

    def exitonclick(self):
        self._flush_svg()

    def done(self):
        self._flush_svg()

    def _flush_svg(self):
        # Render all turtles to SVG
        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" '
            f'width="{self.width}" height="{self.height}" style="background-color: {self.bg_color};">'
        ]

        cx = self.width / 2.0
        cy = self.height / 2.0

        for t in self._turtles:
            # Render filled polygons if any
            for poly in t._polygons:
                pts = " ".join(f"{cx + pt[0]:.2f},{cy - pt[1]:.2f}" for pt in poly['points'])
                svg_parts.append(
                    f'<polygon points="{pts}" fill="{poly["fill"]}" '
                    f'stroke="{poly["stroke"]}" stroke-width="{poly["width"]}" />'
                )

            # Render line segments
            for seg in t._segments:
                x1 = cx + seg['p1'][0]
                y1 = cy - seg['p1'][1]
                x2 = cx + seg['p2'][0]
                y2 = cy - seg['p2'][1]
                svg_parts.append(
                    f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
                    f'stroke="{seg["color"]}" stroke-width="{seg["width"]}" stroke-linecap="round" />'
                )

            # Render text/dot elements
            for el in t._elements:
                if el['type'] == 'dot':
                    dx = cx + el['pos'][0]
                    dy = cy - el['pos'][1]
                    r = el['size'] / 2.0
                    svg_parts.append(f'<circle cx="{dx:.2f}" cy="{dy:.2f}" r="{r:.2f}" fill="{el["color"]}" />')
                elif el['type'] == 'text':
                    tx = cx + el['pos'][0]
                    ty = cy - el['pos'][1]
                    svg_parts.append(
                        f'<text x="{tx:.2f}" y="{ty:.2f}" fill="{el["color"]}" '
                        f'font-family="{el["font"][0]}" font-size="{el["font"][1]}px">{el["text"]}</text>'
                    )

        svg_parts.append('</svg>')
        svg_content = "".join(svg_parts)

        try:
            import _ide_runner_io
            import urllib.parse
            encoded = urllib.parse.quote(svg_content)
            _ide_runner_io.show_plot(f"data:image/svg+xml;utf8,{encoded}")
        except Exception as e:
            pass


class Turtle:
    def __init__(self, shape="classic", undobuffersize=1000, visible=True):
        self.x = 0.0
        self.y = 0.0
        self.angle = 0.0  # degrees: 0 = East, 90 = North, 180 = West, 270 = South
        self._pen_down = True
        self._pen_color = "black"
        self._fill_color = "black"
        self._pen_width = 2
        self._speed = 3
        self._visible = visible
        self._segments = []
        self._elements = []
        self._polygons = []
        self._filling = False
        self._fill_path = []

        global _screen_instance
        if _screen_instance is None:
            _screen_instance = Screen()
        _screen_instance._turtles.append(self)

    # Movement
    def forward(self, distance):
        rad = math.radians(self.angle)
        new_x = self.x + distance * math.cos(rad)
        new_y = self.y + distance * math.sin(rad)
        if self._pen_down:
            self._segments.append({
                'p1': (self.x, self.y),
                'p2': (new_x, new_y),
                'color': self._pen_color,
                'width': self._pen_width
            })
            if self._filling:
                self._fill_path.append((new_x, new_y))
        self.x = new_x
        self.y = new_y

    def fd(self, distance):
        self.forward(distance)

    def backward(self, distance):
        self.forward(-distance)

    def bk(self, distance):
        self.backward(distance)

    def back(self, distance):
        self.backward(distance)

    # Orientation
    def right(self, angle):
        self.angle = (self.angle - angle) % 360.0

    def rt(self, angle):
        self.right(angle)

    def left(self, angle):
        self.angle = (self.angle + angle) % 360.0

    def lt(self, angle):
        self.left(angle)

    def goto(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        new_x = float(x)
        new_y = float(y)
        if self._pen_down:
            self._segments.append({
                'p1': (self.x, self.y),
                'p2': (new_x, new_y),
                'color': self._pen_color,
                'width': self._pen_width
            })
            if self._filling:
                self._fill_path.append((new_x, new_y))
        self.x = new_x
        self.y = new_y

    def setpos(self, x, y=None):
        self.goto(x, y)

    def setposition(self, x, y=None):
        self.goto(x, y)

    def setx(self, x):
        self.goto(x, self.y)

    def sety(self, y):
        self.goto(self.x, y)

    def setheading(self, to_angle):
        self.angle = float(to_angle) % 360.0

    def seth(self, to_angle):
        self.setheading(to_angle)

    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    # Circle
    def circle(self, radius, extent=None, steps=None):
        if extent is None:
            extent = 360.0
        if steps is None:
            steps = max(int(abs(radius) * 3.14159 * 2 / 8), 12)

        step_len = 2.0 * radius * math.sin(math.radians(extent / (2.0 * steps)))
        step_angle = float(extent) / steps

        self.left(step_angle / 2.0)
        for _ in range(steps):
            self.forward(step_len)
            self.left(step_angle)
        self.right(step_angle / 2.0)

    def dot(self, size=None, *color):
        s = size if size is not None else max(self._pen_width + 4, 2 * self._pen_width)
        c = color[0] if color else self._pen_color
        self._elements.append({
            'type': 'dot',
            'pos': (self.x, self.y),
            'size': s,
            'color': str(c)
        })

    # Pen control
    def penup(self):
        self._pen_down = False

    def pu(self):
        self.penup()

    def up(self):
        self.penup()

    def pendown(self):
        self._pen_down = True

    def pd(self):
        self.pendown()

    def down(self):
        self.pendown()

    def isdown(self):
        return self._pen_down

    def pensize(self, width=None):
        if width is not None:
            self._pen_width = max(1, int(width))
        return self._pen_width

    def width(self, width=None):
        return self.pensize(width)

    # Color control
    def color(self, *args):
        if len(args) == 1:
            self._pen_color = str(args[0])
            self._fill_color = str(args[0])
        elif len(args) >= 2:
            self._pen_color = str(args[0])
            self._fill_color = str(args[1])
        return self._pen_color, self._fill_color

    def pencolor(self, color=None):
        if color is not None:
            self._pen_color = str(color)
        return self._pen_color

    def fillcolor(self, color=None):
        if color is not None:
            self._fill_color = str(color)
        return self._fill_color

    def begin_fill(self):
        self._filling = True
        self._fill_path = [(self.x, self.y)]

    def end_fill(self):
        self._filling = False
        if len(self._fill_path) >= 3:
            self._polygons.append({
                'points': list(self._fill_path),
                'fill': self._fill_color,
                'stroke': self._pen_color,
                'width': self._pen_width
            })
        self._fill_path = []

    def speed(self, s=None):
        if s is not None:
            self._speed = s
        return self._speed

    def hideturtle(self):
        self._visible = False

    def ht(self):
        self.hideturtle()

    def showturtle(self):
        self._visible = True

    def st(self):
        self.showturtle()

    def isvisible(self):
        return self._visible

    def pos(self):
        return (self.x, self.y)

    def position(self):
        return self.pos()

    def xcor(self):
        return self.x

    def ycor(self):
        return self.y

    def heading(self):
        return self.angle

    def write(self, arg, move=False, align="left", font=("Arial", 12, "normal")):
        self._elements.append({
            'type': 'text',
            'pos': (self.x, self.y),
            'text': str(arg),
            'color': self._pen_color,
            'font': font
        })

    def clear(self):
        self._segments.clear()
        self._elements.clear()
        self._polygons.clear()

    def reset(self):
        self.clear()
        self.home()
        self._pen_down = True
        self._pen_color = "black"
        self._fill_color = "black"
        self._pen_width = 2


# Global procedural turtle API functions
def _get_turtle():
    global _turtle_instance
    if _turtle_instance is None:
        _turtle_instance = Turtle()
    return _turtle_instance

def _get_screen():
    global _screen_instance
    if _screen_instance is None:
        _screen_instance = Screen()
    return _screen_instance

forward = lambda d: _get_turtle().forward(d)
fd = forward
backward = lambda d: _get_turtle().backward(d)
bk = backward
back = backward
right = lambda a: _get_turtle().right(a)
rt = right
left = lambda a: _get_turtle().left(a)
lt = left
goto = lambda *args: _get_turtle().goto(*args)
setpos = goto
setposition = goto
setx = lambda x: _get_turtle().setx(x)
sety = lambda y: _get_turtle().sety(y)
setheading = lambda a: _get_turtle().setheading(a)
seth = setheading
home = lambda: _get_turtle().home()
circle = lambda *args, **kwargs: _get_turtle().circle(*args, **kwargs)
dot = lambda *args, **kwargs: _get_turtle().dot(*args, **kwargs)
penup = lambda: _get_turtle().penup()
pu = penup
up = penup
pendown = lambda: _get_turtle().pendown()
pd = pendown
down = pendown
isdown = lambda: _get_turtle().isdown()
pensize = lambda *args: _get_turtle().pensize(*args)
width = pensize
color = lambda *args: _get_turtle().color(*args)
pencolor = lambda *args: _get_turtle().pencolor(*args)
fillcolor = lambda *args: _get_turtle().fillcolor(*args)
begin_fill = lambda: _get_turtle().begin_fill()
end_fill = lambda: _get_turtle().end_fill()
speed = lambda *args: _get_turtle().speed(*args)
hideturtle = lambda: _get_turtle().hideturtle()
ht = hideturtle
showturtle = lambda: _get_turtle().showturtle()
st = showturtle
isvisible = lambda: _get_turtle().isvisible()
pos = lambda: _get_turtle().pos()
position = pos
xcor = lambda: _get_turtle().xcor()
ycor = lambda: _get_turtle().ycor()
heading = lambda: _get_turtle().heading()
write = lambda *args, **kwargs: _get_turtle().write(*args, **kwargs)
clear = lambda: _get_turtle().clear()
reset = lambda: _get_turtle().reset()

bgcolor = lambda *args: _get_screen().bgcolor(*args)
setup = lambda *args, **kwargs: _get_screen().setup(*args, **kwargs)
update = lambda: _get_screen().update()
done = lambda: _get_screen().done()
mainloop = done
exitonclick = done
clearscreen = lambda: _get_screen().clearscreen()
resetscreen = clearscreen
Screen = Screen
Turtle = Turtle
Pen = Turtle
`;

