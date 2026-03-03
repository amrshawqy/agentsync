import Handlebars from 'handlebars';

export class TemplateEngine {
	private cache = new Map<string, HandlebarsTemplateDelegate>();

	render(template: string, context: Record<string, unknown>): string {
		let compiled = this.cache.get(template);
		if (!compiled) {
			compiled = Handlebars.compile(template, { noEscape: true });
			this.cache.set(template, compiled);
		}
		return compiled(context);
	}

	clearCache(): void {
		this.cache.clear();
	}
}
