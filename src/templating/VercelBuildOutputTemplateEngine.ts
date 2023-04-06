import TemplateEngine from "./TemplateEngine.js";

// All known template names
// TODO(?): enumerate from file system
const TEMPLATE_NAMES = [
  'error',
  'error_404',
  'error_502',
  'error_base',
  'redirect',
];

interface ErrorInputs {
  http_status_code: number;
  http_status_description: string;
  error_code?: string;
  request_id: string;
}

interface Error404Inputs {
  app_error: boolean;
  title: string;
  subtitle?: string;
  http_status_code: number;
  http_status_description: string;
  error_code?: string;
  request_id: string;
}

interface Error502Inputs {
  app_error: boolean;
  title: string;
  subtitle?: string;
  http_status_code: number;
  http_status_description: string;
  error_code?: string;
  request_id: string;
}

interface ErrorBaseInputs {
  http_status_code: number;
  http_status_description: string;
  view: string;
}

interface RedirectInputs {
  statusCode: number;
  location: string;
}


export default class VercelBuildOutputTemplateEngine extends TemplateEngine {

  constructor(
    modulePath: string = './node_modules/@fastly/serve-vercel-build-output',
  ) {
    super(modulePath, TEMPLATE_NAMES);
  }

  errorTemplate(obj: ErrorInputs) {
    return this.execTemplate('error', obj);
  }

  errorTemplate404(obj: Error404Inputs) {
    return this.execTemplate('error_404', obj);
  }

  errorTemplate502(obj: Error502Inputs) {
    return this.execTemplate('error_502', obj);
  }

  errorTemplateBase(obj: ErrorBaseInputs) {
    return this.execTemplate('error_base', obj);
  }

  redirectTemplate(obj: RedirectInputs) {
    return this.execTemplate('redirect', obj);
  }

}
