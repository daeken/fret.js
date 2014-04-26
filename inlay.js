var inlayMap = {};
inlayMap.centerDot = function(fret, cy, width, space, thickness) {
	if(fret % 12 == 0) {
		var left = new CSG.sphere({
			center: [-width / 2 + (width / 4), cy, thickness + 1.5], 
			radius: 3.0
		});
		var right = new CSG.sphere({
			center: [width / 2 - (width / 4), cy, thickness + 1.5], 
			radius: 3.0
		});
		return left.union(right);
	} else if((fret % 12) % 2 == 1 && (fret % 12) != 1 && (fret % 12) != 11) {
		return new CSG.sphere({
			center: [0, cy, thickness + 1.5], 
			radius: 3.0
		});
	}
};
inlayMap.waveDot = function(fret, cy, width, space, thickness) {
	if(((fret % 12) % 2 == 1 || ((fret % 12 == 0) && fret > 1)) && (fret % 12) != 1 && (fret % 12) != 11) {
		return new CSG.sphere({
			center: [width * 0.3 * Math.cos((fret / 24) * Math.PI * 2 - Math.PI), cy, thickness + 1.5], 
			radius: 3.0 + (Math.cos((fret / 24) * Math.PI * 2 - Math.PI) + 1.0)
		});
	}
};
inlayMap.blocks = function(fret, cy, width, space, thickness) {
	if(((fret % 12) % 2 == 1 || ((fret % 12 == 0) && fret > 1)) && (fret % 12) != 1 && (fret % 12) != 11) {
		return new CSG.cube({
			center: [0, cy, thickness + 1.5], 
			radius: [width * 0.3, space * 0.8, 3.0]
		});
	}
};