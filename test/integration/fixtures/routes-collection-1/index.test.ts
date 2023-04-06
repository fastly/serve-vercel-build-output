import * as path from 'path';
import { fileURLToPath } from 'url';

import { loadChecksFile, loadRouteMatcher, performChecks } from "../../../test_utils/routing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe(`${__dirname.split(path.sep).pop()}`, function() {

  const routeMatcher = loadRouteMatcher(__dirname);
  const checksFile = loadChecksFile(__dirname);
  performChecks(routeMatcher, checksFile);

});
