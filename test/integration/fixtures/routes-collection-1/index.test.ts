import path from "path";
import { loadChecksFile, loadRouteMatcher, performChecks } from "../../../test_utils/routing";

describe(`${__dirname.split(path.sep).pop()}`, function() {

  const routeMatcher = loadRouteMatcher(__dirname);
  const checksFile = loadChecksFile(__dirname);
  performChecks(routeMatcher, checksFile);

});
