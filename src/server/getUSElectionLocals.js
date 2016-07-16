import cheerio from 'cheerio';
import marked from 'marked';
import Promise from 'bluebird';

export default async function getUSElectionLocals() {
	const contentURL = `http://bertha.ig.ft.com/view/publish/gss/${process.env.US_ELECTION_SPREADSHEET_KEY}/options,links`;

	const contentRes = await Promise.resolve(fetch(contentURL))
			.timeout(10000, new Error(`Timeout - bertha took too long to respond: ${contentURL}`));

	if (!contentRes.ok) throw new Error(`Request failed with ${contentRes.status}: ${contentURL}`);

	const data = {};

	const { options } = await contentRes.json();
	for (const { name, value } of options) {
		if (!name) {
			throw new Error(
				`Malformed content. Found an undefined option name in the spreadsheet: ${contentURL}`
			);
		}
		data[name] = value;
	}

	// get poll chart SVG
	async function fetchChart(width, height) {
		const url = `https://ft-ig-us-elections-polltracker.herokuapp.com/polls.svg?fontless=true&startDate=June%207,%202016&size=${width}x${height}&type=area&state=us&logo=false`;
		const res = await Promise.resolve(fetch(url))
			.timeout(10000, new Error(`Timeout - us election poll took too long to respond: ${url}`));
		if (!res.ok) throw new Error(`Request failed with ${res.status}: ${url}`);
		return res.text();
	}

	data.pollCharts = await Promise.props({
		default: fetchChart(300, 200),
		S: fetchChart(400, 300),
		M: fetchChart(400, 300),
		L: fetchChart(300, 200),
		XL: fetchChart(300, 250),
	})

	// process text from markdown to html, then insert data-trackable attributes into any links
	data.text = (() => {
		const $ = cheerio.load(marked(data.text));
		$('a[href]').attr('data-trackable', 'link');
		return $.html();
	})();

	if (data.secondaryText) {
		data.secondaryText = (() => {
			const $ = cheerio.load(marked(data.secondaryText));
			$('a[href]').attr('data-trackable', 'link');
			return $.html();
		})();
	}

	data.isBrightcove = typeof data.video === 'number';
	data.isYoutube = !data.isBrightcove;

	return data;
}
