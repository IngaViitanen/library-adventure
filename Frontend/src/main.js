import App from './App.svelte';
import './locale/i18n';

const app = new App({
	target: document.body,
	hydrate: true
});

export default app;