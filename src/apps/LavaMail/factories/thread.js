const utf8 = require('utf8');

module.exports = ($injector, $translate, co, utils, crypto, user, Email, Manifest, File) => {
	const translations = {
		LB_EMAIL_TO_YOURSELF: ''
	};
	$translate.bindAsObject(translations, 'LAVAMAIL.INBOX');

	function Thread(opt, manifest, labels) {
		const self = this;
		let isLoaded = false;

		const prettify = (a) => {
			let r = a
				.map(e => e.address == user.email ? '' : e.prettyName)
				.filter(e => !!e);

			if (r.length < 1) {
				r = [translations.LB_EMAIL_TO_YOURSELF];
				self.isToYourself = true;
			}

			return r;
		};

		const filterMembers = (members) => {
			let myself = null;
			members = members.
				map(e => {
					if (e.address == user.email || user.aliases.includes(e.address)){
						myself = e;
						return null;
					}
					return e;
				})
				.filter(e => !!e);

			if (members.length < 1 && myself)
				members = [myself];

			return members;
		};

		self.id = opt.id;
		self.name = opt.name;
		self.created = opt.date_created;
		self.modified = opt.date_modified;
		self.isToYourself = false;
		self.emails = opt.emails;

		self.labels = opt.labels && opt.labels.length > 0 ? opt.labels : [];
		self.isRead = !!opt.is_read;
		self.secure = opt.secure;
		self.isReplied = opt.emails && opt.emails.length > 1;

		this.setMembers = (members) => {
			self.members = members && members.length > 0 ? filterMembers(Manifest.parseAddresses(members)) : [];
			self.membersPretty = prettify(self.members);
		};

		this.setMembers(opt.members);

		this.setupManifest = (manifest, setIsLoaded = false) => {
			isLoaded = setIsLoaded;

			self.to = manifest ? manifest.to : [];
			self.cc = manifest ? manifest.cc : [];
			self.bcc = manifest ? manifest.bcc : [];

			self.subject = manifest && manifest.subject ? manifest.subject : opt.subject;
			if (!self.subject)
				self.subject = '';
			self.isForwarded = Email.getSubjectWithoutRe(self.subject) != self.subject;

			self.attachmentsCount = manifest && manifest.files ? manifest.files.length : 0;
		};
		
		this.isLoaded = () => isLoaded;
		this.isLabel = (labelName) => self.labels.some(lid => labels.byId[lid] && labels.byId[lid].name == labelName);
		this.addLabel = (labelName) => utils.uniq(self.labels.concat(labels.byName[labelName].id));
		this.removeLabel = (labelName) => self.labels.filter(x => x != labels.byName[labelName].id);

		self.setupManifest(manifest);
	}

	Thread.fromDraftFile = (file) => co(function *() {
		console.log('raw file', angular.copy(file));
		let thread = new Thread({
			id: file.id,
			is_read: true,
			tags: file.tags,
			name: file.name,
			date_created: file.date_created,
			date_modified: file.date_created
		}, null);

		co(function *(){
			let manifestRaw;
			try {
				file = yield File.fromEnvelope(file);
				thread.setMembers(file.meta.to);

				manifestRaw = file.meta ? {headers: file.meta, parts: []} : null;
			} catch (err) {
				thread.setupManifest(null, true);
				throw err;
			}
			thread.setupManifest(manifestRaw ? Manifest.createFromObject(manifestRaw) : null, true);
		});

		return thread;
	});

	Thread.fromEnvelope = (envelope) => co(function *() {
		let inbox = $injector.get('inbox');
		let labels = yield inbox.getLabels();
		
		let thread = new Thread(envelope, null, labels);

		co(function *(){
			let manifestRaw;
			try {
				manifestRaw = yield co.def(crypto.decodeRaw(envelope.manifest), null);
				console.log('thread manifest', manifestRaw);
			} catch (err) {
				thread.setupManifest(null, true);
				throw err;
			}
			thread.setupManifest(manifestRaw ? Manifest.createFromJson(manifestRaw) : null, true);
		});

		return thread;
	});
	
	return Thread;
};