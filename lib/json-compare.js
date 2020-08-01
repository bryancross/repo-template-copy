'use strict';
const diff = require('deep-diff');

const JSONCompare = function () {};

JSONCompare.prototype.compareJSON = function (lhs, rhs) {
	const diffs = diff(lhs, rhs);
	if (diffs && diffs.length > 0) {
		let difference;
		const output = {};
		output.diffs = [];
		let path = '';

		for (let i = 0; i < diffs.length; i++) {
			difference = diffs[i];
			if (difference.kind === 'N' || difference.kind === 'D') {
				if (difference.path) {
					path = '';
					for (let y = 0; y < difference.path.length; y++) {
						path = path + difference.path[y] + '/';
					}
				}
				output.diffs.push({
					type: (difference.kind === 'D' ? 'Extra element' : 'Missing element'),
					path
				});
			}
		}
		return output.diffs.length > 0 ? output : null;
	}
	return null;
};

module.exports = new JSONCompare();
