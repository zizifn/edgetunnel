import { Command } from 'commander';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { exit } from 'node:process';
let config: {
  port: string;
  address: string;
  uuid: string;
  config: string;
} = null;
const program = new Command();
program.option('-v').action((options) => {
  console.log(options);
  exit();
});
program
  .command('run')
  .description('launch local http proxy for edge pass')
  .option(
    '--config <config>',
    'address of remote proxy, etc https://***.deno.dev/'
  )
  .option(
    '--address <address>',
    'address of remote proxy, etc https://***.deno.dev/'
  )
  .option('--port <port>', 'local port of http proxy proxy')
  .option('--uuid <uuid>', 'uuid')
  .option('--save', 'if this is pass, will save to config.json')
  .action((options) => {
    console.log(__dirname);
    console.log(process.cwd());
    if (options.config) {
      if (existsSync(options.config)) {
        const content = readFileSync(options.config, {
          encoding: 'utf-8',
        });
        config = JSON.parse(content);
        return;
      } else {
        console.error('config not exsit!');
        exit();
      }
    }
    config = options;
    if (config.address && config.port && config.uuid) {
      if (options.save) {
        writeFileSync('./config.json', JSON.stringify(options), {
          encoding: 'utf-8',
        });
      }
    } else {
      console.error('need pass all args!');
      exit();
    }
  });
program.parse();

export { config };
