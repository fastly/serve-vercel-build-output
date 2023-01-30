import { includeBytes } from 'fastly:experimental';
import dot from 'dot';

export class TemplateEngine {

  _templates: Record<string, (inputs: any) => string>;
  _decoder: TextDecoder;

  /**
   * Instantiate this object at init time, rather than runtime.
   * @param modulePath - path to the '@fastly/serve-vercel-build-output' module, relative to C@E app dir
   */
  constructor(
    modulePath: string,
    templateNames: string[],
  ) {
    this._templates = {};
    this._decoder = new TextDecoder();

    this.loadTemplates(modulePath, templateNames);
  }

  loadTemplates(modulePath: string, templateNames: string[]) {
    let templatePath = modulePath;
    while (templatePath !== '/' && templatePath.endsWith('/')) {
      templatePath = templatePath.slice(0, -1);
    }
    templatePath = templatePath += '/resources/templates';

    for (const templateName of templateNames) {
      const bytes = includeBytes( `${templatePath}/${templateName}.jst` );
      const source = this._decoder.decode(bytes);
      this._templates[templateName] = dot.template(source);
    }
  }

  getTemplate(templateName: string) {

    if (templateName in this._templates) {
      return this._templates[templateName];
    }

    return null;

  }

  execTemplate(templateName: string, obj: any) {

    const template = this.getTemplate(templateName);
    if(template == null) {
      return '';
    }

    return template(obj);

  }

}
