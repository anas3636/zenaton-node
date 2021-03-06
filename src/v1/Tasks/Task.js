const AbstractTask = require('./AbstractTask')
const taskManager = require('./TaskManager')
const InvalidArgumentError = require('../../Errors/InvalidArgumentError')

module.exports = function (name, task) {

	if ('string' !== typeof name) {
		throw new InvalidArgumentError('1st parameter (task name) must be a string')
	}

	// task getter
	if (undefined === task) {
		return taskManager.getClass(name)
	}

	// check task definition
	if ('function' !== typeof task && 'object' !== typeof task) {
		throw new InvalidArgumentError('2nd parameter (task implemention) must be an function or an object ')
	}
	if ('object' === typeof task) {
		if (undefined === task.handle) {
			throw new InvalidArgumentError('Your task MUST define a "handle" method')
		}
		if (undefined !== task._promiseHandle) {
			throw new InvalidArgumentError('Your task can NOT redefine a "_promiseHandle" method')
		}
		Object.keys(task).forEach(function (method) {
			if ('function' !== typeof task[method]) {
				throw new InvalidArgumentError('Task\'s methods must be functions - check value of "' + method + '"')
			}
		})
	}

	let _useInit = true

	const TaskClass = class extends AbstractTask {
		constructor(...data) {
			super(name)

			// if this task defined by a simple function?
			let isFn = ('function' === typeof task)

			// set instance data
			if (false === _useInit || isFn || undefined === task['init']) {
				this.data = data[0]
			} else {
				this.data = {}
				task['init'].bind(this.data)(...data)
			}

			let that = this
			// set and bind instance methods
			if (isFn) {
				this.handle = task.bind(this.data)
			} else {
				Object.keys(task).forEach( method => {
					if ('init' !== method) {
						if (AbstractTask.methods().indexOf(method) < 0) {
							// private method
							if (undefined !== that.data[method]) {
								throw new InvalidArgumentError('"' + method + '" is defined more than once in "' + name + '" task')
							}
							that.data[method] = task[method].bind(that.data)
						} else {
							// zenaton method
							that[method] = task[method].bind(that.data)
						}
					}
				})
			}
			// special handle method returning a promise
			this._promiseHandle = function () {
				return new Promise(function (resolve, reject) {
					that.handle(function(err, data) {
						if (err) return reject(err)
						resolve(data)
					})
				})
			}
		}

		/**
		 * static methods used to tell class to
		 * not use construct method to inject data
		 */
		static get _useInit() { return _useInit }
		static set _useInit(value) { _useInit = value }
	}

	// define name of this class
	Object.defineProperty (TaskClass, 'name', {value: name})

	// store this fonction in a singleton to retrieve it later
	taskManager.setClass(name, TaskClass)

	return TaskClass
}
