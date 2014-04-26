$(document).ready(function() {
	function clamp(x, min, max) { return Math.max(Math.min(x, max), min); }

	function lerp(a, b, x) { return (b - a) * clamp(x, 0, 1) + a; }

	function frets() { return parseInt($('#frets').val()) || 22; }
	function scale_length() { return parseFloat($('#scale-length').val()) || 624; }
	function thickness() { return parseFloat($('#thickness').val()) || 5; }
	function nut_width() { return parseFloat($('#nut-width').val()) || 43; }
	function last_width() { return parseFloat($('#last-width').val()) || 57; }
	function nut_radius() { return (parseFloat($('#nut-radius').val()) || 12) * 25.4; }
	function last_radius() { return (parseFloat($('#last-radius').val()) || 12) * 25.4; }
	function fret_thickness() { return parseFloat($('#fret-thickness').val()) || 2; }
	function fret_depth() { return parseFloat($('#fret-depth').val()) || 2; }
	function overhang() { return parseFloat($('#overhang').val()) || 10; }
	function inlays() { return $('#inlays').val(); }
	function total_length() {
		var last_fret = fret_position(frets());
		return last_fret + overhang() + fret_thickness();
	}
	// Y in 0..1 nut->end
	function width_at(y) {
		return lerp(nut_width(), last_width(), y);
	}

	function fret_position(i) {
		var s = scale_length();
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
		var radius = lerp(nut_radius(), last_radius(), y);

		return Math.sqrt(radius*radius - Math.pow((width * x) - (width / 2), 2)) - radius;
	}

	function fingerboard() {
		var xres = 0.25, yres=0.01; // Slices per mm
		var xsteps = Math.ceil(last_width() * xres), ysteps = Math.ceil(total_length() * yres);
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
				insert(-hw + width * x, y * length, thickness() + height_at(x, y));
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
		for(var i = 1; i <= frets(); ++i) {
			var pos = fret_position(i);
			var slot = new CSG.cube({
				center: [0, pos - length / 2, thickness()], 
				radius: [last_width() / 2, fret_thickness() / 2, fret_depth()]
			});
			slot.setColor(0, 0, 1);
			fretboard = fretboard.subtract(slot);
		}
		return fretboard;
	}

	function make_inlay(fret, cy, width, space) {
		var type = inlays();
		if(inlayMap[type] !== undefined)
			return inlayMap[type](fret, cy - total_length() / 2, width, space, thickness());
	}

	function cut_inlays(fretboard) {
		var length = total_length();
		for(var i = 0; i < frets(); ++i) {
			var py = fret_position(i), ny = fret_position(i+1);
			var cy = (py + ny) / 2;
			var width = width_at(cy / length);
			var inlay = make_inlay(i+1, cy, width, ny - cy - fret_thickness());
			if(inlay !== undefined) {
				inlay.setColor(0, 1, 0);
				fretboard = fretboard.subtract(inlay);
			}
		}
		return fretboard;
	}

	function refresh() {
		$('#total-length').val(total_length());

		var fretboard = fingerboard();
		fretboard.setColor(1, 1, 0);

		fretboard = cut_frets(fretboard);
		fretboard = cut_inlays(fretboard);

		viewer.mesh = fretboard.toMesh();
		viewer.gl.ondraw();
	}

	function zipstl(data) {
		zip.createWriter(new zip.BlobWriter(), function(writer) {
			writer.add("fretboard.stl", new zip.TextReader(data), function() {
				writer.close(function(blob) {
					var reader = new window.FileReader();
					reader.readAsDataURL(blob); 
					reader.onloadend = function() {
						base64data = reader.result;
						var d = document.createElement('a');
						d.setAttribute('href', 'data:application/zip;base64,' + encodeURIComponent(base64data.substring(22, base64data.length)));
						d.setAttribute('download', 'fretboard.zip');
						d.click();
					}
				});
			});
		});
	}

	function exportstl() {
		var mesh = viewer.mesh;
		var facets = '';
		for(var i = 0; i < mesh.triangles.length; ++i) {
			facets += 'facet normal 0 0 0\n';
			facets += 'outer loop\n';
			for(var j = 0; j < 3; ++j) {
				var v = mesh.vertices[mesh.triangles[i][j]];
				facets += 'vertex ' + (v[2] * 100) + ' ' + (v[0] * 100) + ' ' + (v[1] * 100) + '\n';
			}
			facets += 'endloop\n';
			facets += 'endfacet\n';
		}
		return 'solid fretboard\n' + facets + 'endsolid fretboard\n';
	}

	var viewer = new Viewer(new CSG(), 800, 800, 5);
	document.getElementById('view').appendChild(viewer.gl.canvas);

	$('#stl-download').click(function() {
		zipstl(exportstl())
		event.preventDefault();
	})

	$('input').change(refresh);
	$('select').change(refresh);
	refresh();
})
