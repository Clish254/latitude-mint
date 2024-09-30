// This file exists because @metaplex-foundation/umi package uses package exports to export the umi/serializers submodule
// React Native's Metro Bundler doesn't support package exports by default so it can't find umi/serializers
// Github issue: https://github.com/metaplex-foundation/umi/issues/94

import fs from 'fs';
import {glob} from 'glob';

async function fixMetaplexFiles() {
  console.log('fixing metaplex files...');
  try {
    const metaplexFiles = await glob(
      'node_modules/@metaplex-foundation/**/*.{ts,js,cjs}',
    );

    for (const file of metaplexFiles) {
      const data = fs.readFileSync(file, 'utf8');
      let result = data.replace(
        /@metaplex-foundation\/umi\/serializers/g,
        '@metaplex-foundation/umi-serializers',
      );

      // Add more specific replacements
      result = result.replace(
        /from ['"]@metaplex-foundation\/umi\/serializers['"];/g,
        "from '@metaplex-foundation/umi-serializers';",
      );
      result = result.replace(
        /import \* as serializers from ['"]@metaplex-foundation\/umi\/serializers['"];/g,
        "import * as serializers from '@metaplex-foundation/umi-serializers';",
      );

      if (file.includes('utf8.cjs')) {
        result = result.replace(
          /\'use strict\'\;/g,
          "'use strict';\nimport 'text-encoding';",
        );
      }

      fs.writeFileSync(file, result, 'utf8');
    }

    console.log('fixed metaplex files');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

fixMetaplexFiles();
