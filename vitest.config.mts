import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				// One runtime for all files (storage still isolated per file/test): on Windows one workerd
				// per file, all at once, made the suite crash intermittently.
				singleWorker: true,
				wrangler: { configPath: './wrangler.json' },
				// Integration suites call the API without tokens; the auth guard is fail-closed otherwise.
				// JWT_SECRET '' overrides the local .dev.vars secret (used by `wrangler dev`) inside tests.
				miniflare: { bindings: { AUTH_DESATIVADA_TESTES: '1', JWT_SECRET: '' } },
			},
		},
	},
});
