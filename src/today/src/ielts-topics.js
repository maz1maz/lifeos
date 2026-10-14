// Practice topics for the Writing marker's «موضوع پیشنهادی» button, written for LifeOS in the style of the test
// (not copied from a book). Task 2 = essay questions in the five usual types; Task 1 = General Training letters
// (Academic Task 1 needs a chart: those come from the books list above the form).
const T2 = [
  'Some people believe that university education should be free for everyone, while others think students should pay for their own studies. Discuss both views and give your own opinion.',
  'In many countries, people are spending more time working and less time with their families. What are the causes of this, and what effects does it have on family life?',
  'Some people think that children should start learning a foreign language at primary school rather than secondary school. Do the advantages of this outweigh the disadvantages?',
  'Many cities are becoming more crowded. What problems does this cause, and what measures could governments take to solve them?',
  'It is better for governments to spend money on public transport than on building new roads. To what extent do you agree or disagree?',
  'Some people say that the best way to improve public health is to increase the number of sports facilities. Others believe this has little effect. Discuss both views and give your opinion.',
  'Online shopping is replacing shopping in stores. Is this a positive or negative development?',
  'Many young people today choose to work for themselves rather than for a company. Why is this happening, and is it a positive trend?',
  'Some people think that museums should be free for everyone, while others believe visitors should pay. Discuss both views and give your own opinion.',
  'Advertising aimed at children should be banned. To what extent do you agree or disagree?',
  'In some countries, the number of older people is increasing quickly. What problems can this cause for society, and how can they be reduced?',
  'Some people believe that technology has made our lives more complicated. Others think it has made life easier. Discuss both views and give your opinion.',
  'Many people now work from home using computers and the internet. What are the advantages and disadvantages of this for workers and employers?',
  'Governments should invest more in renewable energy instead of fossil fuels, even if it costs more in the short term. To what extent do you agree or disagree?',
  'Some parents believe that children should be given complete freedom to choose their hobbies. Others think parents should decide. Discuss both views and give your opinion.',
  'Many people throw away a large amount of food every day. Why does this happen, and what can individuals and governments do about it?',
  'Tourism brings many benefits to a country, but it can also cause problems. Do the advantages of tourism outweigh the disadvantages?',
  'Some people think that schools should teach practical skills such as cooking and managing money instead of traditional subjects. To what extent do you agree or disagree?',
  'Social media has changed the way people communicate. Is this a positive or negative development?',
  'Crime rates are higher in some cities than in others. What are the main causes of crime, and what can be done to reduce it?',
  'Some people believe that professional athletes are paid too much money. To what extent do you agree or disagree?',
  'More and more people are moving from the countryside to cities to find work. Why is this happening, and what problems does it create?',
  'Some people think that the government should control the amount of sugar in food and drinks. Others think this should be a personal choice. Discuss both views and give your opinion.',
  'It is often said that the news media focuses too much on negative stories. Why do you think this is, and what effect does it have on people?',
  'Students should be required to do unpaid community work as part of their studies. To what extent do you agree or disagree?',
  'Many animal species are in danger of disappearing. Why is this happening, and what can be done to protect them?',
  'Some people prefer to live in a house, while others prefer an apartment. Discuss the advantages of both and give your own opinion.',
  'Reading books is less popular than it used to be. What are the reasons for this, and how could people be encouraged to read more?',
  'Some people say that space exploration is a waste of money and that the money should be spent on problems on Earth. To what extent do you agree or disagree?',
  'Nowadays many people choose to have fewer children or no children at all. What are the reasons for this, and is it a positive or negative development?',
];
const T1 = [
  'You recently stayed at a hotel and left a personal item in your room. Write a letter to the hotel manager. In your letter\n• describe the item you left\n• explain where you think you left it\n• say what you would like the manager to do.',
  'A friend is coming to visit your city for the first time. Write a letter to your friend. In your letter\n• suggest the best time to visit\n• describe some places to see\n• give advice about getting around the city.',
  'You bought an electrical appliance online, but it does not work properly. Write a letter to the company. In your letter\n• give details of what you bought\n• explain what the problem is\n• say what you want the company to do.',
  'Your neighbours have been making a lot of noise late at night. Write a letter to them. In your letter\n• explain the situation\n• describe how it affects you\n• suggest a solution.',
  'You would like to take a short course at a local college. Write a letter to the college. In your letter\n• say which course you are interested in\n• explain why you want to do it\n• ask for information about the course.',
  'You have just started a new job. Write a letter to a friend. In your letter\n• describe your new job\n• explain why you chose it\n• say what you like and dislike about it.',
  'Your manager has asked staff to suggest ways to improve the workplace. Write a letter to your manager. In your letter\n• describe a problem at work\n• suggest an improvement\n• explain how it would help staff.',
  'You recently attended a concert, but the event was badly organised. Write a letter to the organisers. In your letter\n• give details of the event\n• explain what went wrong\n• say what you want them to do.',
  'A friend has asked for your advice about learning English. Write a letter to your friend. In your letter\n• say how you learned English\n• recommend some ways to practise\n• offer to help.',
  'You are going to be away from your home for two weeks. Write a letter to a neighbour. In your letter\n• explain why you will be away\n• ask them to do something for you\n• offer something in return.',
  'The local council plans to close a park near your home. Write a letter to the council. In your letter\n• explain how people use the park\n• say why you are against the plan\n• suggest an alternative.',
  'You borrowed a book from a friend and you have lost it. Write a letter to your friend. In your letter\n• apologise for losing the book\n• explain how it happened\n• say what you will do about it.',
];
const END = { task1: '\n\nWrite at least 150 words. Begin your letter as follows: Dear ………,', task2: '\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.' };
// a random topic for the task, never the same as the current one
export function randomTopic(task, current = '') {
  const list = task === 'task1' ? T1 : T2;
  const pool = list.map(t => t + END[task]).filter(t => t !== current);
  return pool[Math.floor(Math.random() * pool.length)];
}
