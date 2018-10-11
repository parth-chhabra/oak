import {cfg} from 'sm-utils';
import _ from 'lodash';
import util from 'util';

import {ConsoleLogs, FileLogs} from './Transports';
import {globalOptions} from './helpers';

const oakTransports = [
	new ConsoleLogs(),
];

// Enable on servers but not in test env
if (cfg.isProductionLike() || (process.env.SERVER && cfg.isDev())) {
	oakTransports.push(new FileLogs({dir: 'logs', table: globalOptions.table}));
}


/**
 * @type {Oak}
 */
let defaultOak;

class Oak {
	/**
	 * Get a logger instance with some options pre set
	 * @param {object|string} opts Default label if string
	 */
	constructor(opts = {}) {
		if (typeof opts === 'object') {
			this.instanceOpts = opts;
			this.instanceOpts.label = opts.label || 'None';
		}
		else {
			this.instanceOpts = {label: String(opts)};
		}
		this.instanceOpts = _.defaults(this.instanceOpts, globalOptions);
		this.timers = {};
	}

	/**
	 * Round off number to precision level
	 * @param {number} number
	 * @param {number} precision
	 * @returns {number}
	 */
	static round(number, precision = 1) {
		/**
		* Round off number to precision level
	 	* @param {number} num
	 	* @param {number} prec
	 	* @returns {number}
	 	*/
		const shift = function (num, prec) {
			const numArray = ('' + num).split('e');
			return +(numArray[0] + 'e' + (numArray[1] ? (+numArray[1] + prec) : prec));
		};
		return shift(Math.round(shift(number, precision)), -precision);
	}

	static now() {
		const hrTime = process.hrtime();
		return (hrTime[0] * 1000) + (hrTime[1] / 1000000);
	}

	/**
	 * Elapsed time since a timestamp
	 * @param {number} since Epoch time from Monitor.now()
	 * @param {number} precision decimal digit precision
	 */
	static elapsed(since, precision = 1) {
		return this.round(this.now() - since, precision);
	}

	/**
	 * Update the default options object for the logger
	 * @param {object} opts
	 */
	updateOptions(opts = {}) {
		this.opts = _.merge(this.opts, opts);
	}

	/**
	 * @param {any[]} args
	 * @param {string|object} level or options object
	 */
	_logWithLevel(args, level) {
		if (typeof level === 'string') level = {level};
		if (typeof args[0] === 'object' && !(args[0] instanceof Error)) {
			args[0] = _.defaults(args[0], level);
		}
		else {
			args.unshift(level);
		}
		this.log(...args);
	}

	/**
	 * @param {Error} err
	 * @param {string} [label]
	 */
	static _parseError(err, label) {
		const errorOpts = {
			level: 'error',
			stack: err.stack,
			errorName: err.name || err.constructor.name || '',
			message: err.message,
		};
		if (err.code) {
			errorOpts.errorCode = err.code;
		}
		if (err.statusCode) {
			_.set(errorOpts, 'ctx.statusCode', err.statusCode);
		}
		if (label) {
			errorOpts.label = label;
		}
		return errorOpts;
	}

	/**
	 * Default level is 'silly' if none is provided
	 * first arg may be an options object
	 */
	log(...args) {
		let opts = {};
		let rest = args;
		if (typeof args[0] === 'object' && !(args[0] instanceof Error)) {
			opts = args[0];
			rest = args.slice(1);
		}
		opts.createdAt = new Date().toISOString();
		for (let i = 0; i < rest.length; i++) {
			const arg = rest[i];
			if (arg instanceof Error) {
				// Log any errors individually
				this.error(Oak._parseError(arg, opts.label));
				rest[i] = arg.message;
			}
		}
		const message = util.format(...rest);
		if (opts.message) {
			opts.originalMessage = opts.message;
		}
		opts.message = message;
		const infoObject = _.defaultsDeep(opts, this.instanceOpts);
		oakTransports.forEach((t) => {
			t.log(infoObject);
		});
	}

	silly(...args) {
		this._logWithLevel(args, 'silly');
	}

	debug(...args) {
		this._logWithLevel(args, 'debug');
	}

	verbose(...args) {
		this._logWithLevel(args, 'verbose');
	}

	info(...args) {
		this._logWithLevel(args, 'info');
	}

	warn(...args) {
		this._logWithLevel(args, 'warn');
	}

	error(...args) {
		this._logWithLevel(args, 'error');
	}

	/**
	 * @param {string} [key] provide a key else a randomly generated one will be assigned
	 * @returns {string} the key
	 */
	time(key) {
		if (!key) key = Math.random().toString(36).substring(2);
		this.timers[key] = Oak.now();
		return key;
	}

	/**
	 * @param {string} key
	 * @param {any[]} args
	 */
	timeEnd(key, ...args) {
		const since = this.timers[key];
		if (since) {
			const duration = Oak.elapsed(since);
			args.unshift(key);
			this._logWithLevel(args, {level: 'info', duration});
			delete this.timers[key];
			return duration;
		}
		return -1;
	}

	/**
	 * Returns a global default logger instance
	 * @returns {Oak}
	 */
	static init() {
		if (!defaultOak) defaultOak = new Oak('Default');
		return defaultOak;
	}

	static log(...args) {
		this.init().log(...args);
	}

	static silly(...args) {
		this.init().silly(...args);
	}

	static debug(...args) {
		this.init().debug(...args);
	}

	static verbose(...args) {
		this.init().verbose(...args);
	}

	static info(...args) {
		this.init().info(...args);
	}

	static warn(...args) {
		this.init().warn(...args);
	}

	static error(...args) {
		this.init().error(...args);
	}

	/**
	 * Starts a timer
	 * @param {string} [key]
	 * @returns {string}
	 */
	static time(key) {
		return this.init().time(key);
	}

	/**
	 * @param {string} key
	 * @param {any[]} args
	 */
	static timeEnd(...args) {
		return this.init().timeEnd(...args);
	}
}

Oak.init();

export default Oak;
