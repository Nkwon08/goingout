export const polls = [
  {
    id: 'poll1',
    city: 'San Francisco',
    question: "Where’s everyone going tonight?",
    options: [
      { id: 'opt1', label: 'Neon Lounge', votes: 24 },
      { id: 'opt2', label: 'Blue Room', votes: 18 },
      { id: 'opt3', label: 'Sky Deck', votes: 12 },
    ],
  },
  {
    id: 'poll2',
    city: 'San Francisco',
    question: "Where’s everyone going tonight?",
    options: [
      { id: 'opt1', label: 'The Grid', votes: 10 },
      { id: 'opt2', label: 'Warehouse 19', votes: 7 },
      { id: 'opt3', label: 'Arcade Bar', votes: 14 },
    ],
  },
];

export const events = [
  {
    id: 'evt1',
    title: 'Neon Nights DJ Set',
    location: 'Neon Lounge',
    description: 'House + techno all night.',
    time: '10:00 PM',
    image: 'https://picsum.photos/seed/neon/600/400',
  },
  {
    id: 'evt2',
    title: 'Blue Room Live Band',
    location: 'Blue Room',
    description: 'Funk and soul vibes.',
    time: '9:30 PM',
    image: 'https://picsum.photos/seed/blue/600/400',
  },
  {
    id: 'evt3',
    title: 'Rooftop Mixer',
    location: 'Sky Deck',
    description: 'Cocktails and city views.',
    time: '8:00 PM',
    image: 'https://picsum.photos/seed/sky/600/400',
  },
];

export const albums = [
  {
    id: 'alb1',
    user: 'alex',
    location: 'Neon Lounge',
    date: 'Oct 12',
    photos: [
      'https://picsum.photos/seed/a1/300/300',
      'https://picsum.photos/seed/a2/300/300',
      'https://picsum.photos/seed/a3/300/300',
      'https://picsum.photos/seed/a4/300/300',
    ],
  },
  {
    id: 'alb2',
    user: 'morgan',
    location: 'Blue Room',
    date: 'Oct 10',
    photos: [
      'https://picsum.photos/seed/b1/300/300',
      'https://picsum.photos/seed/b2/300/300',
      'https://picsum.photos/seed/b3/300/300',
      'https://picsum.photos/seed/b4/300/300',
    ],
  },
];

export const feedPosts = [
  {
    id: 'post1',
    name: 'Alex',
    user: 'alex',
    avatar: 'https://i.pravatar.cc/100?img=7',
    text: 'What a night! 🎉 The vibes were insane at Neon Lounge. Can\'t wait for next week!',
    location: 'Neon Lounge',
    image: 'https://picsum.photos/seed/feed1/800/600',
    likes: 124,
    retweets: 23,
    replies: 8,
    timeAgo: '2h',
    liked: false,
    retweeted: false,
  },
  {
    id: 'post2',
    name: 'Morgan',
    user: 'morgan',
    avatar: 'https://i.pravatar.cc/100?img=8',
    text: 'Live music hits different 🎵 Blue Room never disappoints',
    location: 'Blue Room',
    image: 'https://picsum.photos/seed/feed2/800/600',
    likes: 89,
    retweets: 15,
    replies: 5,
    timeAgo: '5h',
    liked: true,
    retweeted: true,
  },
  {
    id: 'post3',
    name: 'Sam',
    user: 'sam',
    avatar: 'https://i.pravatar.cc/100?img=9',
    text: 'Rooftop views and good company ✨ Sky Deck is the move',
    location: 'Sky Deck',
    image: 'https://picsum.photos/seed/feed3/800/600',
    likes: 203,
    retweets: 42,
    replies: 12,
    timeAgo: '1d',
    liked: false,
    retweeted: false,
  },
  {
    id: 'post4',
    name: 'Taylor',
    user: 'taylor',
    avatar: 'https://i.pravatar.cc/100?img=5',
    text: 'Just discovered this amazing spot downtown. The neon aesthetic is everything 🔥',
    location: 'Neon Lounge',
    image: 'https://picsum.photos/seed/feed4/800/600',
    likes: 156,
    retweets: 31,
    replies: 9,
    timeAgo: '3h',
    liked: false,
    retweeted: false,
  },
  {
    id: 'post5',
    name: 'Jordan',
    user: 'jordan',
    avatar: 'https://i.pravatar.cc/100?img=6',
    text: 'Sky Deck tonight was unreal! The city lights from up here are incredible 🌃',
    location: 'Sky Deck',
    image: 'https://picsum.photos/seed/feed5/800/600',
    likes: 98,
    retweets: 18,
    replies: 6,
    timeAgo: '4h',
    liked: false,
    retweeted: false,
  },
  {
    id: 'post6',
    name: 'Alex',
    user: 'alex',
    avatar: 'https://i.pravatar.cc/100?img=7',
    text: 'Back at Blue Room for round 2! This place never gets old 🎸',
    location: 'Blue Room',
    image: 'https://picsum.photos/seed/feed6/800/600',
    likes: 67,
    retweets: 12,
    replies: 4,
    timeAgo: '6h',
    liked: true,
    retweeted: false,
  },
];

export const groups = [
  { id: 'grp1', name: 'Friday Crew', time: 'Tonight 9 PM', members: 7 },
  { id: 'grp2', name: 'Dance Heads', time: 'Sat 10 PM', members: 5 },
  { id: 'grp3', name: 'Chill Drinks', time: 'Sun 7 PM', members: 8 },
];

export const notifications = [
  { id: 'n1', type: 'invite', text: 'Alex invited you to Friday Crew' },
  { id: 'n2', type: 'vote', text: 'Morgan voted for The Grid' },
  { id: 'n3', type: 'group', text: 'New photos added to Friday Crew' },
];

export const friends = {
  requests: [
    { id: 'f1', name: 'Taylor', avatar: 'https://i.pravatar.cc/100?img=5' },
    { id: 'f2', name: 'Jordan', avatar: 'https://i.pravatar.cc/100?img=6' },
  ],
  accepted: [
    { id: 'f3', name: 'Alex', avatar: 'https://i.pravatar.cc/100?img=7' },
    { id: 'f4', name: 'Morgan', avatar: 'https://i.pravatar.cc/100?img=8' },
    { id: 'f5', name: 'Sam', avatar: 'https://i.pravatar.cc/100?img=9' },
  ],
};


