/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {pick} from 'lodash';
import type {ContextT} from '../../tools/types.flow';

import promiseWaterfall from './promiseWaterfall';
import logger from '../../tools/logger';
import getDependencyConfig from './getDependencyConfig';
import commandStub from './commandStub';
import promisify from './promisify';
import getProjectConfig from './getProjectConfig';
import linkDependency from './linkDependency';
import linkAssets from './linkAssets';
import linkAll from './linkAll';
import findReactNativeScripts from '../../tools/findReactNativeScripts';
import getPlatforms from '../../tools/getPlatforms';

type FlagsType = {
  platforms?: Array<string>,
};

/**
 * Updates project and links all dependencies to it.
 *
 * @param args If optional argument [packageName] is provided,
 *             only that package is processed.
 */
function link([rawPackageName]: Array<string>, ctx: ContextT, opts: FlagsType) {
  let platforms;
  let project;
  try {
    platforms = getPlatforms(ctx.root);
    if (opts.platforms) {
      platforms = pick(platforms, opts.platforms);
    }
    project = getProjectConfig(ctx, platforms);
  } catch (err) {
    logger.error(
      'No package found. Are you sure this is a React Native project?',
    );
    return Promise.reject(err);
  }
  const hasProjectConfig = Object.keys(platforms).reduce(
    (acc, key) => acc || key in project,
    false,
  );
  if (!hasProjectConfig && findReactNativeScripts()) {
    throw new Error(
      '`react-native link [package]` can not be used in Create React Native App projects. ' +
        'If you need to include a library that relies on custom native code, ' +
        'you might have to eject first. ' +
        'See https://github.com/react-community/create-react-native-app/blob/master/EJECTING.md ' +
        'for more information.',
    );
  }

  if (rawPackageName === undefined) {
    return linkAll(ctx, platforms, project);
  }

  // Trim the version / tag out of the package name (eg. package@latest)
  const packageName = rawPackageName.replace(/^(.+?)(@.+?)$/gi, '$1');

  const dependencyConfig = getDependencyConfig(ctx, platforms, packageName);

  const tasks = [
    () => promisify(dependencyConfig.commands.prelink || commandStub),
    () => linkDependency(platforms, project, dependencyConfig),
    () => promisify(dependencyConfig.commands.postlink || commandStub),
    () => linkAssets(platforms, project, dependencyConfig.assets),
  ];

  return promiseWaterfall(tasks).catch(err => {
    logger.error(
      `Something went wrong while linking. Error: ${err.message} \n` +
        'Please file an issue here: https://github.com/react-native-community/react-native-cli/issues',
    );
    throw err;
  });
}

export const func = link;

export default {
  func: link,
  description: 'scope link command to certain platforms (comma-separated)',
  name: 'link [packageName]',
  options: [
    {
      command: '--platforms [list]',
      description:
        'If you want to link dependencies only for specific platforms',
      parse: (val: string) => val.toLowerCase().split(','),
    },
  ],
};

// link;
