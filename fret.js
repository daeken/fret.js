$(document).ready(function() {
	function refresh() {
		var worker = new Worker('fretworker.js');
		worker.onmessage = function(ret) {
			var data = ret.data;
			$('#total-length').val(data[0]);
			var csgo = new CSG();
			csgo.polygons = data[1].polygons;
			viewer.mesh = csgo.toMesh();
			viewer.gl.ondraw();
			$('#recalc').hide();
		};
		$('#recalc').show();
		worker.postMessage({
			frets: parseInt($('#frets').val()) || 22, 
			scale_length: parseFloat($('#scale-length').val()) || 624, 
			thickness: parseFloat($('#thickness').val()) || 5, 
			nut_width: parseFloat($('#nut-width').val()) || 43, 
			last_width: parseFloat($('#last-width').val()) || 57, 
			nut_radius: (parseFloat($('#nut-radius').val()) || 12) * 25.4, 
			last_radius: (parseFloat($('#last-radius').val()) || 12) * 25.4, 
			fret_thickness: parseFloat($('#fret-thickness').val()) || 2, 
			fret_depth: parseFloat($('#fret-depth').val()) || 2, 
			overhang: parseFloat($('#overhang').val()) || 10, 
			inlays: $('#inlays').val()
		});
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
