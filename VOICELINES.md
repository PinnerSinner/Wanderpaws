# Voice lines to record

Generated from the dialogue banks by `node src/dialogue/gen-voicelines.mjs`. **135 lines** in all, grouped by priority. Record as many or as few as you like: every line works on its own, and anything you skip keeps its current fallback.

## How to record and drop them in

- **Format:** mp3, **mono**, **44.1 kHz**, around 128 to 192 kbps. Aim for about **-16 LUFS** integrated, peaks under -1 dBFS, and keep each clip **under about 6 seconds** (most are 1 to 3 s).
- **Where:** save each file at the exact path shown, `assets/user/voice/<voiceId>.mp3`, then run `node tools/build.mjs`. That is all: the build embeds them and the game plays them at once.
- **Loudness:** don't fuss. The game measures each clip's loudness when it first plays and normalises it to -16 LUFS, then plays it through the voice bus (compressor, then limiter) about 5 dB above the music. A sidecar `<file>.mp3.json` with `{ "gainDb": -2.5 }` overrides the measured gain if one ever sounds off.
- **Room:** a quiet room, phone or USB mic 15 to 20 cm away, a little off-axis to avoid pops. Leave half a second of silence at each end; the game doesn't trim.
- **Words:** read the words exactly, so the subtitles match. `{name}` is the player's pet name; say "Oli".
- **If you skip a line:** the character keeps its synthesised "blip" voice (a distinct pitch and timbre per character) plus the floating text, exactly as now. Animals keep their synthesised sounds. Nothing breaks.
- **How many:** the sections are in priority order. Sections 1 to 3 (about 38 clips) make the biggest difference; everything after is a bonus.
- **Where they're used:** chatter is small floating text near the speaker. Narrator lines are bigger and centred. Seu Zé's English shows underneath when "Translate Portuguese" is on.

## 1. Animal sounds and reactions

The animals never speak English. These replace the synthesised sounds for the matching species. Any number of takes per kind works: name them `animal-<species>-<kind>-01.mp3`, `-02`, and the game picks one at random each time. Species ids: `oli`, `cat`, `capybara`, `penguin`, `rabbit`, `duck`, `tortoise`, `frog`, `redpanda`, `octopus`, `snake`, `elephant`, `routercat`. Kinds: bark, happy, sad, excited, sniff, yawn, gulp, sig. Start with Oli:

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/animal-oli-bark-01.mp3` | (Oli: bark) | a single happy bark or woof. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-bark-02.mp3` | (Oli: bark) | a single happy bark or woof. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-happy-01.mp3` | (Oli: happy) | a happy whine or contented noise. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-excited-01.mp3` | (Oli: excited) | excited yips, two or three. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-sad-01.mp3` | (Oli: sad) | a soft whimper. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-sniff-01.mp3` | (Oli: sniff) | close-up sniffing, two or three sniffs. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-yawn-01.mp3` | (Oli: yawn) | a big yawn. Record Oli himself if he obliges |
| `assets/user/voice/animal-oli-gulp-01.mp3` | (Oli: gulp) | a gulp or lip smack. Record Oli himself if he obliges |

## 2. Narrator: world intros and outros

`{name}` is the player's pet name: say "Oli". A recording with `{name}` in it only plays when the pet is called Oli; renamed pets hear the blip voice and see their own name.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/narrator-intro-w1-01.mp3` | Copacabana. Sun, sand, and one very smug pigeon. | Warm storybook narrator, unhurried, a smile in the voice; world intro, sets the scene |
| `assets/user/voice/narrator-outro-w1-01.mp3` | And so {name} left Copacabana slightly sandier than before. | Warm storybook narrator, unhurried, a smile in the voice; world outro, gentle wrap-up |
| `assets/user/voice/narrator-intro-w2-01.mp3` | London. Drizzle, deckchairs and a pigeon in a bowler hat. | Warm storybook narrator, unhurried, a smile in the voice; world intro, sets the scene |
| `assets/user/voice/narrator-outro-w2-01.mp3` | London would never be quite the same. Nor would the bandstand. | Warm storybook narrator, unhurried, a smile in the voice; world outro, gentle wrap-up |
| `assets/user/voice/narrator-intro-w3-01.mp3` | Tijuca. A whole rainforest, right in the middle of the city. | Warm storybook narrator, unhurried, a smile in the voice; world intro, sets the scene |
| `assets/user/voice/narrator-outro-w3-01.mp3` | The jungle grew quiet. Well, quieter. The toucan never stops. | Warm storybook narrator, unhurried, a smile in the voice; world outro, gentle wrap-up |
| `assets/user/voice/narrator-intro-w4-01.mp3` | The Highlands. Snow, heather, and a very cold pigeon. | Warm storybook narrator, unhurried, a smile in the voice; world intro, sets the scene |
| `assets/user/voice/narrator-outro-w4-01.mp3` | The Highlands had seen many things. Never a {name} quite that big. | Warm storybook narrator, unhurried, a smile in the voice; world outro, gentle wrap-up |
| `assets/user/voice/narrator-intro-w5-01.mp3` | The Marcoverse. A cloud city of cables, routers and dreams. | Warm storybook narrator, unhurried, a smile in the voice; world intro, sets the scene |
| `assets/user/voice/narrator-outro-w5-01.mp3` | And {name} got the ball back. Mostly dry. Mostly. | Warm storybook narrator, unhurried, a smile in the voice; world outro, gentle wrap-up |

## 3. Gerald's storyline (all five worlds)

These play in order, one world at a time. The most important set after the narrator.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/gerald-story-w1-01.mp3` | Morning, Copacabana! Sunglasses on. Nobody will recognise me. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w1-02.mp3` | Your ball? It's my ball now. Finders keepers, beach rules. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w1-03.mp3` | I'm only here for the gap year vibes. And the crumbs. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w1-04.mp3` | Right, this beach is getting crowded. Off to London. Ciao, mutt! | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w2-01.mp3` | Back home in London. Bowler hat. Utterly undercover. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w2-02.mp3` | Nobody looks twice at a pigeon in a bowler hat. Nobody. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w2-03.mp3` | My cousin Nigel is guarding the ball. Well, he's napping on it. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w2-04.mp3` | Too hot here. Well, too drizzly. Same thing. Jungle next! | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w3-01.mp3` | Gap year, part two: the jungle chapter. I've got a little hat. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w3-02.mp3` | That toucan keeps heckling me. I am an explorer, sir! | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w3-03.mp3` | I have hidden the ball in the canopy. Probably. Somewhere. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w3-04.mp3` | The mosquitoes have unionised. I'm off somewhere chillier. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w4-01.mp3` | The Highlands! Tartan scarf. Very convincing. Very itchy. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w4-02.mp3` | Ice is just slippery water. I have mastered it. Whoa. Whoa! | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w4-03.mp3` | I am not stuck in a rubber ring. I am relaxing in it. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w4-04.mp3` | Fine. You want the ball? Come to my nest. In the Cloud. Muhaha. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w5-01.mp3` | Welcome to the Cloud. Nice, isn't it? I did the decor. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w5-02.mp3` | Behold my nest. Three thousand balls. Every one stolen. Glorious. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w5-03.mp3` | You've chased me across the whole world? For one ball? Mad. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |
| `assets/user/voice/gerald-story-w5-04.mp3` | Fine. Fine! Here's your ball. It's a bit slobbery anyway. | Gerald: smug London pigeon, posh-ish, very pleased with himself; storyline beat, play it big |

## 4.1 Gerald

Gerald: smug London pigeon, posh-ish, very pleased with himself.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/gerald-throwaway-01.mp3` | Gerald. Two Rs in mastermind. Well, one. Shush. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-throwaway-02.mp3` | I am not a pigeon. I am a pigeon of the world. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-throwaway-03.mp3` | Gap year. Finding myself. Found a chip, mostly. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-throwaway-04.mp3` | You will never catch me. I have wings and a plan. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-throwaway-05.mp3` | The ball? Never heard of it. Lovely ball though. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-throwaway-06.mp3` | Coo. Do you know who I am? Exactly. Mysterious. | Gerald: smug London pigeon, posh-ish, very pleased with himself; ambient chatter, conversational |
| `assets/user/voice/gerald-pigeonScare-01.mp3` | Oi! Those are my associates! | Gerald: smug London pigeon, posh-ish, very pleased with himself; reaction |
| `assets/user/voice/gerald-bump-01.mp3` | Ha! Butterpaws! | Gerald: smug London pigeon, posh-ish, very pleased with himself; sympathetic wince |
| `assets/user/voice/gerald-finish-01.mp3` | Fine, you win this round. I'll be in the next world. Being brilliant. | Gerald: smug London pigeon, posh-ish, very pleased with himself; level complete, celebratory |

## 4.2 Marco

Marco: you, cheery and teacherly, as if mid-jog. This is you.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/marco-throwaway-01.mp3` | Morning! Lovely day for a gobble. | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-throwaway-02.mp3` | Don't worry, I always carry a spare ball. Or six. | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-throwaway-03.mp3` | Right, quick recap: you eat things, you get bigger. Any questions? | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-throwaway-04.mp3` | Fun fact: a ping is just the internet saying "you alright?" | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-throwaway-05.mp3` | Jogging and teaching. My two favourite cardio activities. | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-throwaway-06.mp3` | I'd explain subnetting, but you look busy. | Marco: you, cheery and teacherly, as if mid-jog; ambient chatter, conversational |
| `assets/user/voice/marco-activity-fetch-start-01.mp3` | Fetch! Go on, catch it at the top! | Marco: you, cheery and teacherly, as if mid-jog; mini-game moment |
| `assets/user/voice/marco-activity-fetch-success-01.mp3` | What a catch! Perfect timing! | Marco: you, cheery and teacherly, as if mid-jog; mini-game moment |
| `assets/user/voice/marco-activity-fetch-fail-01.mp3` | Ah, nearly! I've got loads more. | Marco: you, cheery and teacherly, as if mid-jog; mini-game moment |
| `assets/user/voice/marco-finish-01.mp3` | Brilliant work! Class dismissed! | Marco: you, cheery and teacherly, as if mid-jog; level complete, celebratory |
| `assets/user/voice/marco-milestone-01.mp3` | Look at you! You've scaled up nicely. | Marco: you, cheery and teacherly, as if mid-jog; big moment, impressed |

## 4.3 Captain Kev

Captain Kev: booming lifeguard, everything is an emergency.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/kev-throwaway-01.mp3` | Attention all beachgoers! Stay calm! There is nothing happening! | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-throwaway-02.mp3` | Code amber! Someone has left a flip-flop unattended! | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-throwaway-03.mp3` | This is your captain speaking. Apply sun cream. That is an order. | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-throwaway-04.mp3` | All hands on deck! Well, all paws on sand. | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-throwaway-05.mp3` | Man the lifeboats! No, wait, it's just a seagull. | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-throwaway-06.mp3` | Situation report: sand is still sandy. Monitoring closely. | Captain Kev: booming lifeguard, everything is an emergency; ambient chatter, conversational |
| `assets/user/voice/kev-bump-01.mp3` | Collision! Collision! Is anyone hurt? No? Carry on! | Captain Kev: booming lifeguard, everything is an emergency; sympathetic wince |
| `assets/user/voice/kev-splash-01.mp3` | Body in the water! Oh, it's swimming. Happily. Fine. | Captain Kev: booming lifeguard, everything is an emergency; reacting to a splash |
| `assets/user/voice/kev-timerWarn-01.mp3` | Time is running out! This is not a drill! Well, it might be! | Captain Kev: booming lifeguard, everything is an emergency; urgent but friendly |
| `assets/user/voice/kev-milestone-01.mp3` | Vessel upgraded! You're a frigate now! | Captain Kev: booming lifeguard, everything is an emergency; big moment, impressed |

## 4.4 Seu Zé

Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR). Seu Zé speaks only Brazilian Portuguese: record the pt-BR words (the English is the on-screen subtitle). A Carioca friend would be perfect; if you record it yourself, ham up the opera.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/ze-throwaway-01.mp3` | Olha o mate! Olha o mate geladiiinho!<br>*(Iced mate! Lovely iced mate!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-throwaway-02.mp3` | Ó o biscoito Globo! Doce e salgado!<br>*(Globo biscuits! Sweet and salty!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-throwaway-03.mp3` | Queijo coalho na brasa! Quentinho!<br>*(Grilled cheese on a stick! Nice and hot!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-throwaway-04.mp3` | Picolé! Picolé de fruta! Refresca a alma!<br>*(Ice lollies! Fruit lollies! Refreshes the soul!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-throwaway-05.mp3` | Água de coco! Direto do coco, meu amor!<br>*(Coconut water! Straight from the coconut, my love!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-throwaway-06.mp3` | Açaí! Açaí que dá energia pra correr na areia!<br>*(Açaí! Açaí to give you energy to run on the sand!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); ambient chatter, conversational |
| `assets/user/voice/ze-milestone-01.mp3` | Nossa, como cresceu! Que bicho grande!<br>*(Wow, look how it's grown! What a big animal!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); big moment, impressed |
| `assets/user/voice/ze-weather-parade-01.mp3` | Olha o samba! Olha a bateria!<br>*(Here comes the samba! Here comes the drum band!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); reacting to the weather |
| `assets/user/voice/ze-finish-01.mp3` | Acabou! Que espetáculo! Bis! Bis!<br>*(It's over! What a show! Encore! Encore!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); level complete, celebratory |

## 4.5 Auntie Pru

Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/pru-throwaway-01.mp3` | Is it time for a cuppa? It's always time for a cuppa. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-throwaway-02.mp3` | Coffee? I'd rather drink puddle water, dear. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-throwaway-03.mp3` | Milk in after the tea. I won't hear otherwise. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-throwaway-04.mp3` | This flask has been in the family since nineteen fifty-two. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-throwaway-05.mp3` | They put cinnamon in their tea here. Cinnamon! In tea! | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-throwaway-06.mp3` | A proper brew needs four minutes. Not three. Four. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; ambient chatter, conversational |
| `assets/user/voice/pru-buff-tea-01.mp3` | There we are. A proper cuppa. Feel better? | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; satisfied sip |
| `assets/user/voice/pru-buff-tea-02.mp3` | It's the water, dear. Makes all the difference. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; satisfied sip |
| `assets/user/voice/pru-shake-01.mp3` | Oh! My good cardigan! | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; just got sprayed |
| `assets/user/voice/pru-finish-01.mp3` | Well done, dear. Kettle on, I think. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; level complete, celebratory |

## 4.6 Packet

Packet: chirpy robotic sat-nav, over-keen.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/packet-throwaway-01.mp3` | In two hundred metres, turn left. Then keep turning left. Wheee! | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-throwaway-02.mp3` | Recalculating! Recalculating! Oh, you were right. Carry on. | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-throwaway-03.mp3` | Welcome to the Marcoverse! Please keep your paws inside the network at all times. | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-throwaway-04.mp3` | I'm a packet! I'm on my way somewhere! Not sure where! Exciting! | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-throwaway-05.mp3` | My TTL is sixty-four. I've got loads of hops left! | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-throwaway-06.mp3` | Did you know I have a header AND a payload? I'm very well put together. | Packet: chirpy robotic sat-nav, over-keen; ambient chatter, conversational |
| `assets/user/voice/packet-timerWarn-01.mp3` | Your session is about to expire! Please hurry! | Packet: chirpy robotic sat-nav, over-keen; urgent but friendly |
| `assets/user/voice/packet-milestone-01.mp3` | Upgrade complete! You are now a gigabit animal! | Packet: chirpy robotic sat-nav, over-keen; big moment, impressed |
| `assets/user/voice/packet-finish-01.mp3` | You have arrived at your destination! Connection closed gracefully! | Packet: chirpy robotic sat-nav, over-keen; level complete, celebratory |

## 5. Pickups and combos

Short and punchy; these fire a lot, so keep them under two seconds. `{count}` is said as "ten" (it only plays on round numbers, but the text shows the real count).

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/marco-gobble-01.mp3` | Ooh, good catch! | Marco: you, cheery and teacherly, as if mid-jog; quick reaction |
| `assets/user/voice/marco-combo-01.mp3` | {count} in a row! Throughput is through the roof! | Marco: you, cheery and teacherly, as if mid-jog; rising excitement |
| `assets/user/voice/gerald-gobble-01.mp3` | Oi! I was saving that for later. | Gerald: smug London pigeon, posh-ish, very pleased with himself; quick reaction |
| `assets/user/voice/gerald-combo-01.mp3` | A {count} combo? Show-off. | Gerald: smug London pigeon, posh-ish, very pleased with himself; rising excitement |
| `assets/user/voice/kev-gobble-01.mp3` | Cargo secured! | Captain Kev: booming lifeguard, everything is an emergency; quick reaction |
| `assets/user/voice/kev-combo-01.mp3` | Multiple targets acquired! {count} and counting! | Captain Kev: booming lifeguard, everything is an emergency; rising excitement |
| `assets/user/voice/packet-gobble-01.mp3` | Payload received! | Packet: chirpy robotic sat-nav, over-keen; quick reaction |
| `assets/user/voice/packet-combo-01.mp3` | {count} packets in sequence! Perfect ordering! | Packet: chirpy robotic sat-nav, over-keen; rising excitement |

## 6. Easter eggs

Payoff lines for secrets around the worlds (SPEC §7). Player-caption egg lines stay as text, so they are not listed.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/gerald-egg-H2.mp3` | This is a rubber ring. I am relaxing. Do not look at me. | Gerald: smug London pigeon, posh-ish, very pleased with himself; easter egg payoff, land the joke |
| `assets/user/voice/gerald-egg-H11.mp3` | I am gliding. Majestically. Whoa. WHOA. | Gerald: smug London pigeon, posh-ish, very pleased with himself; easter egg payoff, land the joke |
| `assets/user/voice/gerald-egg-M2.mp3` | Is it me, or am I losing bits of myself? Packet loss. Rude. | Gerald: smug London pigeon, posh-ish, very pleased with himself; easter egg payoff, land the joke |
| `assets/user/voice/marco-egg-C4.mp3` | Fancy a game of fetch? I've got a spare! | Marco: you, cheery and teacherly, as if mid-jog; easter egg payoff, land the joke |
| `assets/user/voice/marco-egg-M6.mp3` | Right, class. Today: the OSI model. No napping at layer one. | Marco: you, cheery and teacherly, as if mid-jog; easter egg payoff, land the joke |
| `assets/user/voice/marco-egg-M10.mp3` | SYN, SYN-ACK, ACK! A perfect three-way handshake! | Marco: you, cheery and teacherly, as if mid-jog; easter egg payoff, land the joke |
| `assets/user/voice/marco-egg-M14.mp3` | Have you tried turning it off and on again? | Marco: you, cheery and teacherly, as if mid-jog; easter egg payoff, land the joke |
| `assets/user/voice/kev-egg-C11.mp3` | Oi. I can see you. | Captain Kev: booming lifeguard, everything is an emergency; easter egg payoff, land the joke |
| `assets/user/voice/ze-egg-C8.mp3` | Acabou o biscoito! Ganhou um chapéu!<br>*(The biscuits are gone! You've won a hat!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); easter egg payoff, land the joke |
| `assets/user/voice/ze-egg-T11.mp3` | AÇAÍ! OLHA O AÇAÍ! MAIS ALTO QUE A CACHOEIRA!<br>*(AÇAÍ! GET YOUR AÇAÍ! LOUDER THAN THE WATERFALL!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); easter egg payoff, land the joke |
| `assets/user/voice/ze-egg-C9.mp3` | Um canudinho pra você! Saúde!<br>*(A little straw for you! Cheers!)* | Seu Zé: Rio beach vendor singing like an opera tenor (pt-BR); easter egg payoff, land the joke |
| `assets/user/voice/pru-egg-L13.mp3` | It's the water, dear. London water. Makes a proper brew. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; easter egg payoff, land the joke |
| `assets/user/voice/pru-egg-H8.mp3` | Found my flask, did you? Go on then, have a sip. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; easter egg payoff, land the joke |
| `assets/user/voice/packet-egg-M5.mp3` | TTL decreasing! {count} hops left! Still loving it! | Packet: chirpy robotic sat-nav, over-keen; easter egg payoff, land the joke |
| `assets/user/voice/packet-egg-M3.mp3` | Error 404: door not found. Try looking away. | Packet: chirpy robotic sat-nav, over-keen; easter egg payoff, land the joke |
| `assets/user/voice/narrator-egg-L3.mp3` | The 127 to Localhost pulled up, exactly on time. | Warm storybook narrator, unhurried, a smile in the voice; easter egg payoff, land the joke |
| `assets/user/voice/narrator-egg-C5.mp3` | GOLAÇO! | Warm storybook narrator, unhurried, a smile in the voice; easter egg payoff, land the joke |
| `assets/user/voice/narrator-egg-H1.mp3` | Good stone! | Warm storybook narrator, unhurried, a smile in the voice; easter egg payoff, land the joke |
| `assets/user/voice/nigel-egg-L2.mp3` | Oi! Gerald's my cousin, and 'e owes me a fiver! | Nigel: Gerald's Cockney cousin, cheeky and gruff; easter egg payoff, land the joke |

## 7. Achievements

The narrator announces some achievements (about half of them, never twice in 20 s).

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/narrator-achievement-01.mp3` | Achievement unlocked. Someone has been busy. | Warm storybook narrator, unhurried, a smile in the voice; proud announcement |
| `assets/user/voice/narrator-achievement-02.mp3` | And for that, {name} received a small, shiny honour. | Warm storybook narrator, unhurried, a smile in the voice; proud announcement |
| `assets/user/voice/narrator-achievement-03.mp3` | A new achievement. The pigeon is furious. | Warm storybook narrator, unhurried, a smile in the voice; proud announcement |
| `assets/user/voice/narrator-achievement-04.mp3` | Let it be written: {name} did a thing. | Warm storybook narrator, unhurried, a smile in the voice; proud announcement |

## 8. Funny throwaways

Extras that make the world feel alive. Nice to have.

| File | Words | Delivery |
|---|---|---|
| `assets/user/voice/narrator-throwaway-01.mp3` | Meanwhile, somewhere, a pigeon was plotting. | Warm storybook narrator, unhurried, a smile in the voice; ambient chatter, conversational |
| `assets/user/voice/narrator-throwaway-02.mp3` | It was, by all accounts, a very good day for gobbling. | Warm storybook narrator, unhurried, a smile in the voice; ambient chatter, conversational |
| `assets/user/voice/narrator-throwaway-03.mp3` | {name} was having the time of their life. | Warm storybook narrator, unhurried, a smile in the voice; ambient chatter, conversational |
| `assets/user/voice/narrator-throwaway-04.mp3` | Nobody ever expects the {name}. | Warm storybook narrator, unhurried, a smile in the voice; ambient chatter, conversational |
| `assets/user/voice/kev-weather-rain-01.mp3` | Precipitation detected! Everyone under a parasol! | Captain Kev: booming lifeguard, everything is an emergency; reacting to the weather |
| `assets/user/voice/kev-weather-fog-01.mp3` | Fog bank rolling in! Sound the foghorn! | Captain Kev: booming lifeguard, everything is an emergency; reacting to the weather |
| `assets/user/voice/pru-weather-rain-01.mp3` | Rain! Proper British weather. I feel at home. | Auntie Pru: genteel British auntie, tea-obsessed, faintly scandalised; reacting to the weather |
| `assets/user/voice/packet-weather-datastorm-01.mp3` | Data storm! Hold on to your headers! | Packet: chirpy robotic sat-nav, over-keen; reacting to the weather |

## Beyond this list

Every line in the game has a voiceId, so any of the 771 lines in `src/dialogue/banks/` can be recorded the same way: the file name is `<speaker>-<tag>-<nn>.mp3` (for example `gerald-throwaway-07.mp3` is the 7th line in Gerald's throwaway list). Egg lines that World-data writes itself use their copy key with dots turned into dashes (`egg.C1.pong` becomes `egg-C1-pong.mp3`).
