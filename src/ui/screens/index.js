// Screen registry for show(screen, params).

import { titleScreen } from './title.js';
import { worldsScreen } from './worlds.js';
import { animalsScreen } from './animals.js';
import { dressingScreen } from './dressing.js';
import { comicScreen } from './comic.js';
import { pauseScreen } from './pause.js';
import { settingsScreen } from './settings.js';
import { journalScreen } from './journal.js';
import { speciesScreen, achievementsScreen, statsScreen } from './lists.js';
import { shopScreen } from './shop.js';
import { dailyScreen } from './daily.js';
import { endScreen } from './end.js';
import { photoScreen } from './photo.js';

export const SCREENS = {
  title: titleScreen,
  worlds: worldsScreen,
  play: worldsScreen,
  animals: animalsScreen,
  dressing: dressingScreen,
  comic: comicScreen,
  pause: pauseScreen,
  settings: settingsScreen,
  journal: journalScreen,
  species: speciesScreen,
  shop: shopScreen,
  achievements: achievementsScreen,
  stats: statsScreen,
  daily: dailyScreen,
  end: endScreen,
  photo: photoScreen,
};
