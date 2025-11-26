export interface CrimeMetadata {
  name: string
  description: string
  difficulty: number
  spawn: {
    level: number
    name: string
  }
  scope: {
    cost: number
    return: number
  }
  prerequisite: string | null
  slots: Array<{
    id: string
    name: string
    required_item: {
      id: number
      name: string
      is_used: boolean
    } | null
  }>
}

export const CRIME_METADATA: Record<string, CrimeMetadata> = {
  "Mob Mentality": {
    name: "Mob Mentality",
    description:
      "A group of pranksters has organized a flash mob at the local mall. Take advantage of the confusion by using the event as cover to steal luxury goods. Posing as flash mobbers, you'll weave through the throngs of people, moving swiftly from store to store. While mall security is distracted by the chaos, your crew will loot the joint, turning the spectacle into a lucrative operation. Stay sharp and act fast—and don't get caught up in the crowd!",
    difficulty: 1,
    spawn: { level: 1, name: "λ" },
    scope: { cost: 1, return: 2 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Looter", required_item: { id: 568, name: "Jemmy", is_used: false } },
      { id: "P2", name: "Looter", required_item: null },
      { id: "P3", name: "Looter", required_item: { id: 568, name: "Jemmy", is_used: false } },
      { id: "P4", name: "Looter", required_item: null },
    ],
  },
  "Pet Project": {
    name: "Pet Project",
    description:
      "Some people pay a lot of money for their fancy pets, and they'll pay even more if their lives are threatened. These pampered pooches enjoy a life of luxury most can only dream of. Imagine how distraught their owners will be upon discovering their beloved pets are missing. When the owners have gone out for the evening, we'll swoop in and steal both dogs. The ransom we can demand for these expensive breeds will make it all worthwhile.",
    difficulty: 1,
    spawn: { level: 1, name: "λ" },
    scope: { cost: 1, return: 2 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Kidnapper", required_item: { id: 1361, name: "Dog Treats", is_used: true } },
      { id: "P2", name: "Muscle", required_item: { id: 1362, name: "Net", is_used: false } },
      { id: "P3", name: "Picklock", required_item: { id: 1203, name: "Lockpicks", is_used: false } },
    ],
  },
  "Best of the Lot": {
    name: "Best of the Lot",
    description:
      "A wealthy Arab sheikh has had his luxury car impounded for unpaid parking fines. The billionaire playboy abandoned the car and returned to his home country, leaving it ripe for the taking. Your mission: break into the impound lot, locate the vehicle, and drive it off without tripping the alarm. If things go sideways, a quick flash of a police badge should clear the way.",
    difficulty: 2,
    spawn: { level: 1, name: "λ" },
    scope: { cost: 1, return: 2 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Picklock", required_item: { id: 1203, name: "Lockpicks", is_used: false } },
      { id: "P2", name: "Car Thief", required_item: null },
      { id: "P3", name: "Muscle", required_item: null },
      { id: "P4", name: "Imitator", required_item: { id: 1350, name: "Police Badge", is_used: false } },
    ],
  },
  "Cash Me if You Can": {
    name: "Cash Me if You Can",
    description:
      "The broker has intercepted a cash delivery van on its way to the bank. The cash boxes are empty but the vehicle itself may prove useful. There is a brief window of opportunity to use the delivery van as cover to rob the ATMs at Loaners Bank. The robbery must take place at dawn, before the bank opens to the public, while minimal staff members are present.",
    difficulty: 2,
    spawn: { level: 1, name: "λ" },
    scope: { cost: 1, return: 2 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Thief", required_item: { id: 1381, name: "ID Badge", is_used: true } },
      { id: "P2", name: "Thief", required_item: { id: 1379, name: "ATM Key", is_used: true } },
      { id: "P3", name: "Lookout", required_item: null },
    ],
  },
  "Gaslight the Way": {
    name: "Gaslight the Way",
    description:
      "A wealthy older couple has been bragging about their expensive lifestyle on social media. It's time to show them the error of their ways by ransacking their penthouse. To gain access, two of you will pose as the building's maintenance crew investigating a gas leak. With evidence of tampering conveniently \"discovered,\" they will be forced to call security, at which point the rest of the team will enter. Once the owners are out of the way, you'll have to work quickly to loot the place and escape before anyone alerts the real authorities.",
    difficulty: 3,
    spawn: { level: 2, name: "Σ" },
    scope: { cost: 2, return: 3 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Imitator", required_item: { id: 643, name: "Construction Helmet", is_used: false } },
      { id: "P2", name: "Looter", required_item: null },
      { id: "P3", name: "Imitator", required_item: { id: 1381, name: "ID Badge", is_used: true } },
      { id: "P4", name: "Looter", required_item: null },
      { id: "P5", name: "Imitator", required_item: { id: 1381, name: "ID Badge", is_used: true } },
      { id: "P6", name: "Looter", required_item: null },
    ],
  },
  "Market Forces": {
    name: "Market Forces",
    description:
      "We've been hired by Duke to collect protection money from a group of stubborn market traders. Not everyone will be willing to pay up, so don't be afraid to use intimidation to get what you want. Just be careful not to go too far as there could be undercover cops loitering in the area. If the feds show up, turn on the charm; a little kickback might just smooth things over.",
    difficulty: 3,
    spawn: { level: 2, name: "Σ" },
    scope: { cost: 2, return: 3 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Enforcer", required_item: null },
      { id: "P2", name: "Negotiator", required_item: null },
      { id: "P3", name: "Lookout", required_item: null },
      { id: "P4", name: "Arsonist", required_item: { id: 172, name: "Gasoline", is_used: true } },
      { id: "P5", name: "Muscle", required_item: null },
    ],
  },
  "Smoke and Wing Mirrors": {
    name: "Smoke and Wing Mirrors",
    description:
      "A golden opportunity has arisen to swipe a high-end car from an upmarket showroom. The plan is simple: split your team into two, with one group posing as an influencer and their photographer, and the other acting like interested buyers. Together, you'll separate the sales team, nab the keys, and race away with a luxury ride. If you can assemble the right crew, you'll soon be cruising to success.",
    difficulty: 3,
    spawn: { level: 2, name: "Σ" },
    scope: { cost: 2, return: 3 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Car Thief", required_item: { id: 1380, name: "RF Detector", is_used: false } },
      { id: "P2", name: "Imitator", required_item: { id: 1383, name: "DSLR Camera", is_used: false } },
      { id: "P3", name: "Hustler", required_item: null },
      { id: "P4", name: "Hustler", required_item: null },
    ],
  },
  "Snow Blind": {
    name: "Snow Blind",
    description:
      "An up-and-coming rapper, Lil Drizzle, is hosting a party and needs a huge quantity of cocaine. His manager, Juliet, has been told that your product is the best in the business–but of course, that's a lie. Dupe these naive morons by selling them PCP laced with dental anesthetic to mimic the numbing effect of cocaine. But don't let them take too much or they'll overdose!",
    difficulty: 4,
    spawn: { level: 2, name: "Σ" },
    scope: { cost: 2, return: 3 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Hustler", required_item: null },
      { id: "P2", name: "Imitator", required_item: { id: 201, name: "PCP", is_used: true } },
      { id: "P3", name: "Muscle", required_item: null },
      { id: "P4", name: "Muscle", required_item: null },
    ],
  },
  "Stage Fright": {
    name: "Stage Fright",
    description:
      "Our mission is clear: send a message to Swiss Toni, the ruthless mob boss who thinks he's untouchable. To do this, we'll threaten his mistress, Clara, and make him realize that nobody is off-limits in this town. Toni's side-piece is heading out for a night at the opera flanked by her elite guards. We'll ambush her in plain sight, dividing our crew between high ground and street level, ready to strike from all angles at the intersection. The bounty is vague, but we're free to take whatever we can from Clara. And tonight's performance? It's destined to be a tragedy.",
    difficulty: 4,
    spawn: { level: 2, name: "Σ" },
    scope: { cost: 2, return: 3 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Enforcer", required_item: null },
      { id: "P2", name: "Muscle", required_item: null },
      { id: "P3", name: "Muscle", required_item: null },
      { id: "P4", name: "Muscle", required_item: null },
      { id: "P5", name: "Lookout", required_item: { id: 1258, name: "Binoculars", is_used: false } },
      { id: "P6", name: "Sniper", required_item: null },
    ],
  },
  "Counter Offer": {
    name: "Counter Offer",
    description:
      "Morrigan's Military Surplus has an impressive array of specialist weapons and armor for sale. They're offering a 100% discount to anyone bold enough to rob them. Bypass their strict one-in-one-out policy, subdue the employees, and crack open their high-tech weapon stores. Carrying a gun through the entrance will set off the detectors and bring the T.C.P.D. running, so don't do that, or you'll be going home in handcuffs.",
    difficulty: 5,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Robber", required_item: { id: 1429, name: "Zip Ties", is_used: true } },
      { id: "P2", name: "Looter", required_item: { id: 1429, name: "Zip Ties", is_used: true } },
      { id: "P3", name: "Hacker", required_item: { id: 70, name: "Polymorphic Virus", is_used: true } },
      { id: "P4", name: "Picklock", required_item: { id: 1203, name: "Lockpicks", is_used: false } },
      { id: "P5", name: "Engineer", required_item: { id: 981, name: "Wire Cutters", is_used: false } },
    ],
  },
  "Guardian Ángels": {
    name: "Guardian Ángels",
    description:
      "The cartel needs your help recovering hidden cash from a confiscated aircraft. The authorities seized a shipment of drugs flown into Torn, but they missed the money concealed within the plane's interiors. The plane is now sitting in a low-security hangar. Your job is to get the cartel's couriers inside, help them locate the money, and disappear before anyone else shows up to claim it.",
    difficulty: 5,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Enforcer", required_item: null },
      { id: "P2", name: "Hustler", required_item: null },
      { id: "P3", name: "Engineer", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
    ],
  },
  "Leave No Trace": {
    name: "Leave No Trace",
    description:
      "Our client has just been arrested for a heinous crime. She wants us to retrieve a cell phone containing sensitive data that must be erased. The bad news: the device is inside a police station. The good news: the police captain has been bribed to make things easier. We'll need to deploy a code phrase while talking to the desk sergeant to get inside. Once we've obtained the phone, we should wipe the data outside the premises to avoid leaving a digital footprint, then return it undamaged. And don't forget to bring a cop badge–it might come in handy.",
    difficulty: 5,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Techie", required_item: null },
      { id: "P2", name: "Negotiator", required_item: { id: 1350, name: "Police Badge", is_used: false } },
      { id: "P3", name: "Imitator", required_item: { id: 1350, name: "Police Badge", is_used: false } },
    ],
  },
  "No Reserve": {
    name: "No Reserve",
    description:
      "The team needs a military-grade vehicle for an upcoming assault on the auction house. A high-spec Humvee is undergoing repairs off-base at an army maintenance facility. Guard presence is light, but mistakes will still draw unwanted attention. Slip in, neutralize the guards, and leave with the vehicle before the military shows up.",
    difficulty: 5,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Car Thief", required_item: { id: 159, name: "Bolt Cutters", is_used: false } },
      { id: "P2", name: "Techie", required_item: { id: 856, name: "Spray Paint : Black", is_used: true } },
      { id: "P3", name: "Engineer", required_item: { id: 576, name: "Chloroform", is_used: true } },
    ],
  },
  "Bidding War": {
    name: "Bidding War",
    description:
      "A number of valuable artifacts are up for sale at the auction house today. The broker represents powerful international buyers who would rather not pay the reserve price. Armed with a military-grade Humvee, your task is to breach the main hall with bombs and bravado, grab as many treasures as possible, and escape safely in the armored vehicle. Be careful—if the auction house security team shows up, you'll pay a steep price.",
    difficulty: 6,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: "No Reserve",
    slots: [
      { id: "P1", name: "Robber", required_item: { id: 568, name: "Jemmy", is_used: false } },
      { id: "P2", name: "Driver", required_item: null },
      { id: "P3", name: "Robber", required_item: { id: 222, name: "Flash Grenade", is_used: true } },
      { id: "P4", name: "Robber", required_item: { id: 1284, name: "Dental Mirror", is_used: false } },
      { id: "P5", name: "Bomber", required_item: { id: 190, name: "C4 Explosive", is_used: true } },
      { id: "P6", name: "Bomber", required_item: { id: 190, name: "C4 Explosive", is_used: true } },
    ],
  },
  "Honey Trap": {
    name: "Honey Trap",
    description:
      "Honey, a local stripper, has been blackmailing powerful individuals after bedding them, threatening to expose their proclivities. Find her and retrieve any evidence she's keeping without causing a scene–our client rewards discretion. Oh, and you might need to buy a dance, so take your money in a clip because this is an upmarket establishment.",
    difficulty: 6,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Enforcer", required_item: { id: 1080, name: "Billfold", is_used: false } },
      { id: "P2", name: "Muscle", required_item: null },
      { id: "P3", name: "Muscle", required_item: { id: 1080, name: "Billfold", is_used: false } },
    ],
  },
  "Sneaky Git Grab": {
    name: "Sneaky Git Grab",
    description:
      "Twisted Pixel is one of the most respected game studios in the world, known for its cutting-edge game engine. The plan is simple: steal the source code for the studio's upcoming title, delete it from their systems, and hold the data to ransom. Their air-gapped servers are heavily protected, so this calls for an offline infiltration. Disguised as pizza couriers, you'll talk your way in, find the server, and do the job by hand. With their corporate secrets at risk of being leaked, the studio will pay a handsome sum to avoid the data being shared online.",
    difficulty: 6,
    spawn: { level: 3, name: "Φ" },
    scope: { cost: 3, return: 4 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Imitator", required_item: null },
      { id: "P2", name: "Pickpocket", required_item: null },
      { id: "P3", name: "Hacker", required_item: { id: 71, name: "Tunneling Virus", is_used: true } },
      { id: "P4", name: "Techie", required_item: { id: 579, name: "Wireless Dongle", is_used: false } },
    ],
  },
  "Blast from the Past": {
    name: "Blast from the Past",
    description:
      "We've received intel on a private vault owned by a wealthy mobster. The vault, built in the 1900s, has vulnerabilities in its hinges and surrounding structure that can be exploited using core drilling and explosives. Despite its antique facade, the vault is protected by a sophisticated security system that protects the entire building. Therefore, assembling a team with specialized skills is crucial for the success of this operation.",
    difficulty: 7,
    spawn: { level: 4, name: "Ψ" },
    scope: { cost: 4, return: 5 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Picklock", required_item: null },
      { id: "P2", name: "Hacker", required_item: { id: 103, name: "Firewalk Virus", is_used: true } },
      { id: "P3", name: "Engineer", required_item: { id: 1431, name: "Core Drill", is_used: true } },
      { id: "P4", name: "Bomber", required_item: { id: 1430, name: "Shaped Charge", is_used: true } },
      { id: "P5", name: "Muscle", required_item: { id: 1429, name: "Zip Ties", is_used: true } },
      { id: "P6", name: "Picklock", required_item: null },
    ],
  },
  "Break the Bank": {
    name: "Break the Bank",
    description:
      "The target is the west side branch of the Torn and Shanghai Bank. While its security system appears robust, it is undermined by one critical flaw: the bank's employees. By applying pressure to the bank's soft, human underbelly, we should be able to bypass the security measures and gain access to the vaults. Take hostages if necessary, but remain alert for any would-be heroes attempting to thwart the operation. Strike hard, strike fast, and vanish before the alarm even begins to sound.",
    difficulty: 8,
    spawn: { level: 4, name: "Ψ" },
    scope: { cost: 4, return: 5 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Robber", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
      { id: "P2", name: "Muscle", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
      { id: "P3", name: "Muscle", required_item: { id: 1429, name: "Zip Ties", is_used: true } },
      { id: "P4", name: "Thief", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
      { id: "P5", name: "Muscle", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
      { id: "P6", name: "Thief", required_item: { id: 1331, name: "Hand Drill", is_used: false } },
    ],
  },
  "Clinical Precision": {
    name: "Clinical Precision",
    description:
      "A high-profile senator is recovering at the hospital under police protection. A self-proclaimed man of the people, the old fool insisted on being treated on a public ward. He has consistently voted against the broker's interests, so we need to recall him... permanently. A messy kill risks drawing scrutiny that could expose the client, so it must look like an accident. That means no weapons. Infiltrate the hospital, find the senator's ward, and take him out quietly. The cleaner the job, the bigger the payday and the better your chances of walking out alive.",
    difficulty: 8,
    spawn: { level: 4, name: "Ψ" },
    scope: { cost: 4, return: 5 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Imitator", required_item: { id: 1094, name: "Syringe", is_used: true } },
      { id: "P2", name: "Cat Burglar", required_item: null },
      { id: "P3", name: "Assassin", required_item: { id: 576, name: "Chloroform", is_used: true } },
      { id: "P4", name: "Cleaner", required_item: { id: 1012, name: "Blood Bag : Irradiated", is_used: true } },
    ],
  },
  "Stacking the Deck": {
    name: "Stacking the Deck",
    description:
      "In this high-stakes operation, we're laying the groundwork for a grand heist. With a carefully choreographed plan, the team will infiltrate the casino, bypassing the guards to breach their security network. The goal is twofold: plant our operatives' identities in their employee database, then trigger the vault's alarm to map their response protocols. If you pull this off, the odds of success will be stacked in your favor.",
    difficulty: 8,
    spawn: { level: 5, name: "Ω" },
    scope: { cost: 5, return: 6 },
    prerequisite: null,
    slots: [
      { id: "P1", name: "Cat Burglar", required_item: { id: 568, name: "Jemmy", is_used: false } },
      { id: "P2", name: "Driver", required_item: { id: 226, name: "Smoke Grenade", is_used: true } },
      { id: "P3", name: "Hacker", required_item: { id: 73, name: "Stealth Virus", is_used: true } },
      { id: "P4", name: "Imitator", required_item: { id: 1381, name: "ID Badge", is_used: true } },
    ],
  },
  "Ace in the Hole": {
    name: "Ace in the Hole",
    description:
      "Having prepared the groundwork, the stage is set for a grand heist at the Lucky Shots Casino. One of you will pose as an employee and slip in through the staff entrance, while two more will blend in as everyday gamblers on the casino floor. Once the team is in position, a fake breach will bait security into opening the vault door. That's the moment to strike. By the time backup arrives, the crew should already be gone, the cash smuggled out in a laundry cart, and the casino beaten in a game they never knew they were playing.",
    difficulty: 9,
    spawn: { level: 5, name: "Ω" },
    scope: { cost: 5, return: 6 },
    prerequisite: "Stacking the Deck",
    slots: [
      { id: "P1", name: "Imitator", required_item: { id: 1381, name: "ID Badge", is_used: true } },
      { id: "P2", name: "Muscle", required_item: null },
      { id: "P3", name: "Muscle", required_item: null },
      { id: "P4", name: "Hacker", required_item: null },
      { id: "P5", name: "Driver", required_item: null },
    ],
  },
}

export function getCrimeMetadata(crimeName: string): CrimeMetadata | null {
  return CRIME_METADATA[crimeName] || null
}
