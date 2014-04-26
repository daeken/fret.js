$(document).ready(function() {
	var serialize = function(obj) {
		var str = [];
		for(var p in obj)
			if (obj.hasOwnProperty(p)) {
				str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
			}
		return str.join("&");
	};
	var deserialize = function(pairs) {
		var obj = {};
		pairs = pairs.split('&');
		for(var i in pairs) {
			var pair = pairs[i].split('=', 2);
			obj[pair[0]] = pair[1];
		}
		return obj;
	};
	var pmap = {
		frets: '#frets', 
		scale_length: '#scale-length', 
		thickness: '#thickness', 
		nut_width: '#nut-width', 
		last_width: '#last-width', 
		nut_radius: '#nut-radius', 
		last_radius: '#last-radius', 
		fret_thickness: '#fret-thickness', 
		fret_depth: '#fret-depth', 
		overhang: '#overhang', 
		inlays: '#inlays'
	};

	var outstanding = 0;
	function refresh() {
		outstanding++;
		var worker = new Worker('fretworker.js');
		worker.onmessage = function(ret) {
			var data = ret.data;
			$('#total-length').val(data[0]);
			var csgo = new CSG();
			csgo.polygons = data[1].polygons;
			viewer.mesh = csgo.toMesh();
			viewer.gl.ondraw();
			if(--outstanding == 0)
				$('#recalc').hide();
		};
		$('#recalc').show();
		var data = {
			frets: parseInt($('#frets').val()) || 22, 
			scale_length: parseFloat($('#scale-length').val()) || 624, 
			thickness: parseFloat($('#thickness').val()) || 5, 
			nut_width: parseFloat($('#nut-width').val()) || 43, 
			last_width: parseFloat($('#last-width').val()) || 57, 
			nut_radius: parseFloat($('#nut-radius').val()) || 12, 
			last_radius: parseFloat($('#last-radius').val()) || 12, 
			fret_thickness: parseFloat($('#fret-thickness').val()) || 2, 
			fret_depth: parseFloat($('#fret-depth').val()) || 2, 
			overhang: parseFloat($('#overhang').val()) || 10, 
			inlays: $('#inlays').val()
		};
		window.location.hash = '#' + serialize(data);
		data.nut_radius *= 25.4;
		data.last_radius *= 25.4;
		worker.postMessage(data);
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

	$('input[type=text]').change(refresh);
	$('select').change(refresh);
	$('#wireframe').change(function() {
		viewer.wireframe = $('#wireframe').is(':checked');
		viewer.gl.ondraw();
	});
	var first = true;
	window.onhashchange = function() {
		var changed = false || (first === true);
		first = false;
		var hash = deserialize(window.location.hash.substring(1, window.location.hash.length));
		for(var k in pmap)
			if(hash[k] !== undefined) {
				if($(pmap[k]).val() != hash[k]) {
					$(pmap[k]).val(hash[k]);
					changed = true;
				}
			}
		if(changed)
			refresh();
	};
	window.onhashchange();
})
