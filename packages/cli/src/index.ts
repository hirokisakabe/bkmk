#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program.name('bkmk').description('Bookmark manager CLI').version('0.0.1');

program.parse();
