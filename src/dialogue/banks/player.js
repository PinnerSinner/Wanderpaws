// Player thought captions: italic floating text in the animal's name. The
// animals never speak English, so these are thoughts, voiced only by a species
// sound (`react`). `species` limits a line to some animals; others are for all.
// {name} is the player's chosen name, {item} an item's name.

const DOG = ['oli'];
const CAT = ['cat', 'routercat'];
const t = (text, species, react, w) => ({ t: text, ...(species ? { species } : {}), ...(react ? { react } : {}), ...(w ? { w } : {}) });

export default {
  speaker: 'player',
  lines: {
    throwaway: [
      t('{name} is considering the bus.'),
      t('{name} is thinking about lunch.'),
      t('{name} would like it noted that this is fun.'),
      t('{name} has forgotten what they were doing. Gobbling, probably.'),
      t('{name} suspects the pigeon is up to something.'),
      t('{name} is feeling quite peckish, all things considered.'),
      t('{name} wonders if clouds are edible.'),
      t('{name} is pretending not to look at that sandwich.'),
      t('{name} has a plan. The plan is: eat it.'),
      t('{name} feels about forty percent bigger. Spiritually.'),
      t('{name} would like a nap after this. Maybe during.'),
      t('{name} is fairly sure that bin was looking at them.'),
      t('{name} is counting things to gobble. One. Lots.'),
      t('{name} misses the ball. Briefly. Ooh, a shell.'),
      t('{name} is on a very important mission.'),
      t('{name} thinks the sky is a nice colour today.'),
      t('{name} is having the best day ever. Again.'),
      t('{name} wonders why everyone keeps saying "aww".'),
      t('{name} is trying to remember where the ball went.'),
      t('{name} is feeling unstoppable. And slightly round.'),
      t('{name} has decided everything is a snack until proven otherwise.'),
      t('{name} hears a crinkle somewhere. Investigating.'),
      t('{name} is fairly sure they could fit a deckchair in there.'),
      t('{name} would like to speak to the manager of pigeons.'),
      t('{name} is thinking big thoughts. And bigger snacks.'),
      t('{name} is wondering what the bus tastes like.'),
      // Oli: food-obsessed, water-mad, tail-wagging whirlwind
      t('{name} can smell sausages. Somewhere. Somewhere!', DOG, 'sniff', 2),
      t('{name} is thinking about the sea. And sausages. Sea sausages.', DOG, 'happy', 2),
      t('{name} would very much like to roll in something.', DOG, 'excited', 2),
      t('{name}\'s tail is wagging without permission.', DOG, 'happy', 2),
      t('{name} has not been fed in at least nine minutes.', DOG, 'sad', 2),
      // cats: disdain
      t('{name} is unimpressed by all of this.', CAT, null, 2),
      t('{name} will gobble that later. When it least expects it.', CAT, null, 2),
      t('{name} did not ask for this adventure. But fine.', CAT, null, 2),
      t('{name} is judging the pigeon. Harshly.', CAT, null, 2),
      t('{name} is entirely above all this. Ooh, a string.', CAT, null, 2),
      // capybara: zen
      t('{name} is at peace with the universe.', ['capybara'], 'happy', 2),
      t('{name} is very relaxed about the whole thing.', ['capybara'], null, 2),
      t('{name} would like everyone to calm down a bit.', ['capybara'], null, 2),
      t('{name} is one with the pond.', ['capybara'], null, 2),
      // penguin
      t('{name} wishes this was ice. Everything should be ice.', ['penguin'], null, 2),
      t('{name} is considering a belly-slide. Always considering.', ['penguin'], 'happy', 2),
      t('{name} is dressed for a party nobody mentioned.', ['penguin'], null, 2),
      // rabbit
      t('{name} is thinking about carrots at an alarming speed.', ['rabbit'], 'excited', 2),
      t('{name} could do a binky right now. Might do.', ['rabbit'], 'happy', 2),
      t('{name} is very alert. Very, very alert.', ['rabbit'], 'sniff', 2),
      // duck
      t('{name} has some thoughts on bread. Positive thoughts.', ['duck'], 'happy', 2),
      t('{name} would rather be in a pond, frankly.', ['duck'], null, 2),
      t('{name} is unbothered. Water off a duck\'s back.', ['duck'], null, 2),
      // tortoise
      t('{name} is taking their time. As is their right.', ['tortoise'], null, 2),
      t('{name} has been around for ages. Nothing surprises them.', ['tortoise'], null, 2),
      t('{name} will get there. Eventually. Possibly by Thursday.', ['tortoise'], 'yawn', 2),
      // frog
      t('{name} is thinking about flies. Exclusively.', ['frog'], null, 2),
      t('{name} would like a lily pad and a quiet life.', ['frog'], null, 2),
      t('{name} could jump on that. Should jump on that.', ['frog'], 'excited', 2),
      // red panda
      t('{name} is too fluffy for this nonsense.', ['redpanda'], null, 2),
      t('{name} would like to climb something. Anything.', ['redpanda'], 'excited', 2),
      t('{name} is thinking about bamboo. Mostly bamboo.', ['redpanda'], null, 2),
      // octopus
      t('{name} has eight arms and eight plans.', ['octopus'], null, 2),
      t('{name} is changing colour out of sheer excitement.', ['octopus'], 'happy', 2),
      t('{name} wonders why land is so dry.', ['octopus'], null, 2),
      // snake
      t('{name} is thinking long, slithery thoughts.', ['snake'], null, 2),
      t('{name} is very misunderstood. And very hungry.', ['snake'], null, 2),
      t('{name} would like a warm rock and a big lunch.', ['snake'], null, 2),
      // elephant
      t('{name} never forgets a snack.', ['elephant'], 'happy', 2),
      t('{name} is trying to tiptoe. It is not working.', ['elephant'], null, 2),
      t('{name} is wondering if the trunk counts as a hand.', ['elephant'], null, 2),
      // router-cat
      t('{name} has full bars and zero patience.', ['routercat'], null, 2),
      t('{name} is buffering. Please wait.', ['routercat'], null, 2),
      t('{name} has updated their firmware. Feels great.', ['routercat'], 'happy', 2),
    ],
    food: [
      t('{name} is having a lovely time with that.', null, 'happy'),
      t('{name} says NOM.', null, 'happy'),
      t('{name} would like seconds. And thirds.', null, 'happy'),
      t('{name} rates that ten out of ten.', null, 'happy'),
      t('{name} has found their calling. It is food.', DOG, 'happy', 2),
      t('{name} would happily do that all day.', DOG, 'excited', 2),
      t('{name} did not chew. Chewing is for amateurs.', DOG, 'gulp', 2),
    ],
    gobble: [
      t('{name} enjoyed that more than expected.'),
      t('{name} wonders where that went.'),
      t('{name} would gobble that again.'),
      t('{name} is collecting the set.'),
      t('{name} feels slightly heavier.'),
    ],
    almost: [
      t('{name} is considering the {item}.'),
      t('{name} is nearly big enough for the {item}. Nearly.'),
      t('{name} will be back for the {item}.'),
      t('{name} is eyeing up the {item}.'),
      t('{name} is going to need a few more snacks before the {item}.'),
    ],
    bump: [
      t('{name} meant to do that.', null, 'sad'),
      t('{name} is fine. Totally fine. Ow.', null, 'sad'),
      t('{name} would like that wall removed.', null, 'sad'),
      t('{name} has dropped a few things. Whoopsie.', null, 'sad'),
      t('{name} blames the pigeon.', null, 'sad'),
    ],
    idle: [
      t('{name} is having a little think.', null, 'yawn'),
      t('{name} could really go for a nap.', null, 'yawn'),
      t('{name} is waiting for something to happen.', null, 'sniff'),
      t('{name} is admiring the view.', null, null),
      t('{name} has entered energy saving mode.', null, 'yawn'),
      t('{name} is wondering if anyone has a biscuit.', DOG, 'sad', 2),
      t('{name} is being majestic. Nobody is watching.', CAT, null, 2),
    ],
    splash: [
      t('{name} LOVES THE WATER.', DOG, 'excited', 3),
      t('{name} is a fish now. A fluffy fish.', DOG, 'excited', 2),
      t('{name} did not want to get wet. Too late.', CAT, 'sad', 3),
      t('{name} is enjoying a paddle.', null, 'happy'),
      t('{name} is splashing about magnificently.', null, 'excited'),
      t('{name} would like the water to be warmer.', null, null),
    ],
    shake: [
      t('{name} is doing the big shake. Stand back.', null, 'happy'),
      t('{name} shares the water with everyone. Generously.', null, 'happy'),
      t('{name} is nearly dry. Ish.', null, null),
    ],
    egg: [
      t('{name} has found something odd.', null, 'excited'),
      t('{name} is pretty sure that wasn\'t meant to happen.', null, 'excited'),
      t('{name} has discovered a secret. Shhh.', null, 'excited'),
    ],
    golden: [
      t('{name} found something golden! Shiny!', null, 'excited'),
      t('{name} feels very fancy right now.', null, 'excited'),
    ],
    star: [
      t('{name} is a star. Officially.', null, 'happy'),
      t('{name} would like to thank the snacks.', null, 'happy'),
    ],
    milestone: [
      t('{name} feels enormous.', null, 'excited'),
      t('{name} has grown. Everything looks smaller now.', null, 'excited'),
      t('{name} is getting quite big, actually.', null, 'excited'),
      t('{name} can see over things now. New snacks!', null, 'excited'),
    ],
    combo: [
      t('{name} is on a roll. {count} in a row!', null, 'excited'),
      t('{name} cannot be stopped.', null, 'excited'),
      t('{name} is in the zone.', null, 'excited'),
    ],
    finish: [
      t('{name} is very proud.', null, 'happy'),
      t('{name} could eat the world. Wait, they just did.', null, 'happy'),
      t('{name} would like a nap now, please.', null, 'yawn'),
    ],
    pigeonScare: [
      t('{name} has scattered the pigeons. Glorious.', null, 'excited'),
      t('{name} only wanted to say hello.', null, 'happy'),
      t('{name} is the pigeon\'s worst nightmare.', null, 'excited'),
    ],
    timerWarn: [
      t('{name} senses time running out.', null, 'excited'),
      t('{name} had better get a move on.', null, null),
    ],
    nearMiss: [
      t('{name} saw that coming. Mostly.', null, null),
      t('{name} is too quick for that.', null, 'happy'),
    ],
    'buff-tea': [
      t('{name} feels refreshed and very British.', null, 'happy'),
      t('{name} has had a lovely cup of tea.', null, 'happy'),
    ],
    'buff-wobble': [
      t('{name} is feeling a bit wobbly.', null, 'happy'),
      t('{name} is not sure that was lime squash.', null, 'yawn'),
    ],
    go: [
      t('{name} is ready. So ready.', null, 'excited'),
      t('{name} is off!', null, 'bark'),
    ],
    'activity-sniffTrail-start': [t('{name} has caught a scent. Follow the nose!', null, 'sniff')],
    'activity-sniffTrail-success': [t('{name} followed the trail to the end. Treats!', null, 'happy')],
    'activity-sniffTrail-fail': [t('{name} lost the scent. Distracted by a leaf.', null, 'sad')],
    'activity-start': [t('{name} is up for a challenge.', null, 'excited')],
    'activity-success': [t('{name} nailed it.', null, 'happy')],
    'activity-fail': [t('{name} will try again later.', null, 'sad')],
  },
};
