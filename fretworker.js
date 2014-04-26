importScripts('csg.js', 'inlay.js');

function clamp(x, min, max) { return Math.max(Math.min(x, max), min); }

function lerp(a, b, x) { return (b - a) * clamp(x, 0, 1) + a; }

function total_length() {
	var last_fret = fret_position(frets);
	return last_fret + overhang + fret_thickness;
}
// Y in 0..1 nut->end
function width_at(y) {
	return lerp(nut_width, last_width, y);
}

function fret_position(i) {
	var s = scale_length;
	return s - (s / (Math.pow(2, (i / 12))))
}

function vsub(a, b) {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function vcross(a, b) {
	return [
		(a[1] * b[2]) - (b[1] * a[2]), 
		(a[2] * b[0]) - (b[2] * a[0]), 
		(a[0] * b[1]) - (b[0] * a[1])
	];
}
function vlength(x) {
	return Math.sqrt((x[0] * x[0]) + (x[1] * x[1]) + (x[2] * x[2]))
}
function vnormalize(x) {
	var length = vlength(x);
	return [x[0] / length, x[1] / length, x[2] / length];
}
function vneg(x) {
	return [-x[0], -x[1], -x[2]];
}

function polytocsg(indices, vertices) {
	var normals = [];
	return CSG.fromPolygons(indices.map(function(tri) {
		var b = vertices[tri[0]], a = vertices[tri[1]], c = vertices[tri[2]];
		var normal = vnormalize(vcross(vsub(b, a), vsub(c, a)));
		return new CSG.Polygon(tri.reverse().map(function(i) {
			return new CSG.Vertex(vertices[i], normal);
		}));
	}));
}

function height_at(x, y) {
	var width = width_at(y);
	var radius = lerp(nut_radius, last_radius, y);

	return Math.sqrt(radius*radius - Math.pow((width * x) - (width / 2), 2)) - radius;
}

function fingerboard() {
	var xres = 0.25, yres=0.01; // Slices per mm
	var xsteps = Math.ceil(last_width * xres), ysteps = Math.ceil(total_length() * yres);
	var xiter = 1.0 / xsteps, yiter = 1.0 / ysteps;
	var indices = [], vertices = [];
	var lastrow = null, currow, firstrow;
	var length = total_length();

	function cap(row, invert) {
		var cind = vertices.length;
		vertices.push([0, vertices[row[0]][1], 0]);
		for(var i = 0; i < row.length - 1; ++i) {
			if(invert == false) {
				indices.push([
					cind, 
					row[i + 1], 
					row[i]
				]);
			} else {
				indices.push([
					cind, 
					row[i], 
					row[i + 1]
				]);
			}
		}
	}

	for(var y = 0; y <= 1.0; y += yiter) {
		var width = width_at(y), hw = width / 2;
		currow = [];
		function insert(x, y, z) {
			currow.push(vertices.length);
			vertices.push([x, y - length / 2.0, z]);
		}
		insert(-hw, y * length, 0);
		for(var x = 0; x <= 1.0; x += xiter) {
			insert(-hw + width * x, y * length, thickness + height_at(x, y));
		}
		insert(hw, y * length, 0);

		if(lastrow != null) {
			for(var i = 0; i < currow.length - 1; ++i) {
				var a = lastrow[i % lastrow.length], 
					b = currow[i % lastrow.length], 
					c = lastrow[(i + 1) % lastrow.length], 
					d = currow[(i + 1) % lastrow.length];
				indices.push([a, b, c]);
				indices.push([c, b, d]);
			}
		} else
			cap(currow, true);

		if(firstrow === undefined)
			firstrow = currow;
		lastrow = currow;
	}
	indices.push([firstrow[0], lastrow[lastrow.length - 1], lastrow[0]]);
	indices.push([firstrow[0], firstrow[firstrow.length - 1], lastrow[lastrow.length - 1]]);
	cap(lastrow, false);

	return polytocsg(indices, vertices);
}

function cut_frets(fretboard) {
	var length = total_length();
	for(var i = 1; i <= frets; ++i) {
		var pos = fret_position(i);
		var slot = new CSG.cube({
			center: [0, pos - length / 2, thickness], 
			radius: [last_width / 2, fret_thickness / 2, fret_depth]
		});
		slot.setColor(0, 0, 1);
		fretboard = fretboard.subtract(slot);
	}
	return fretboard;
}

function make_inlay(fret, cy, width, space) {
	var type = inlays;
	if(inlayMap[type] !== undefined)
		return inlayMap[type](fret, cy - total_length() / 2, width, space, thickness);
}

function cut_inlays(fretboard) {
	var length = total_length();
	for(var i = 0; i < frets; ++i) {
		var py = fret_position(i), ny = fret_position(i+1);
		var cy = (py + ny) / 2;
		var width = width_at(cy / length);
		var inlay = make_inlay(i+1, cy, width, ny - cy - fret_thickness);
		if(inlay !== undefined) {
			inlay.setColor(0, 1, 0);
			fretboard = fretboard.subtract(inlay);
		}
	}
	return fretboard;
}

onmessage = function(event) {
	var data = event.data;

	frets = data.frets;
	scale_length = data.scale_length;
	thickness = data.thickness;
	nut_width = data.nut_width;
	last_width = data.last_width;
	nut_radius = data.nut_radius;
	last_radius = data.last_radius;
	fret_thickness = data.fret_thickness;
	fret_depth = data.fret_depth;
	overhang = data.overhang;
	inlays = data.inlays;

	var fretboard = fingerboard();
	fretboard.setColor(1, 1, 0);

	fretboard = cut_frets(fretboard);
	fretboard = cut_inlays(fretboard);
	postMessage([total_length(), fretboard]);
};
