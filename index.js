import axios from 'axios';
import { Client } from '@notionhq/client';

// Create a new object 'notion' that gives our code access to the Notion credentials set up in the .env file
const notion = new Client({ auth: process.env.NOTION_KEY });

const pokeArray = [];

async function getPokemon() {
  const start = 1;
  const end = 5;
  for (let i = start; i <= end; i++) {
    try {
      const poke = await axios.get(`https://pokeapi.co/api/v2/pokemon/${i}`);
      const typesRaw = poke.data.types;
      const typesArray = typesRaw.map(type => ({
        name: type.type.name,
      }));
      const processedName = poke.data.species.name
        .split(/-/)
        .map(name => name.charAt(0).toUpperCase() + name.slice(1))
        .join(' ')
        .replace(/^Mr M/, 'Mr. M')
        .replace(/^Mime Jr/, 'Mime Jr.')
        .replace(/^Mr R/, 'Mr. R')
        .replace(/mo O/, 'mo-o')
        .replace(/Porygon Z/, 'Porygon-Z')
        .replace(/Type Null/, 'Type: Null')
        .replace(/Ho Oh/, 'Ho-Oh')
        .replace(/Nidoran F/, 'Nidoran♀')
        .replace(/Nidoran M/, 'Nidoran♂')
        .replace(/Flabebe/, 'Flabébé');
      const bulbURL = `https://bulbapedia.bulbagarden.net/wiki/${processedName.replace(
        ' ',
        '_'
      )}_(Pokémon)`;
      const sprite = poke.data.sprites.front_default || poke.data.sprites.other['official-artwork'].front_default;
      const pokeData = {
        name: processedName,
        number: poke.data.id,
        types: typesArray,
        height: poke.data.height,
        weight: poke.data.weight,
        hp: poke.data.stats[0].base_stat,
        attack: poke.data.stats[1].base_stat,
        defense: poke.data.stats[2].base_stat,
        'special-attack': poke.data.stats[3].base_stat,
        'special-defense': poke.data.stats[4].base_stat,
        speed: poke.data.stats[5].base_stat,
        sprite,
        artwork: poke.data.sprites.other['official-artwork'].front_default,
        bulbURL,
      };
      console.log(`Fetched ${pokeData.name}.`);
      pokeArray.push(pokeData);
    } catch (error) {
      console.error(`Error fetching Pokemon ${i}: ${error}`);
    }
  }

  for (let pokemon of pokeArray) {
    try {
      const flavor = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.number}`);
      const flavorText = flavor.data.flavor_text_entries.find(({ language: { name } }) => name === 'en').flavor_text.replace(
        /\n|\f|\r/g,
        ' '
      );
      const category = flavor.data.genera.find(({ language: { name } }) => name === 'en').genus;
      const generation = flavor.data.generation.name.split(/-/).pop().toUpperCase();
      pokemon['flavor-text'] = flavorText;
      pokemon.category = category;
      pokemon.generation = generation;
      console.log(`Fetched flavor info for ${pokemon.name}.`);
    } catch (error) {
      console.error(`Error fetching flavor info for ${pokemon.name}: ${error}`);
    }
  }

  createNotionPage();
}

getPokemon();

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

async function createNotionPage() {
  for (let pokemon of pokeArray) {
    const data = {
      parent: {
        type: 'database_id',
        database_id: process.env.NOTION_DATABASE_ID,
      },
      icon: {
        type: 'external',
        external: {
          url: pokemon.sprite,
        },
      },
      cover: {
        type: 'external',
        external: {
          url: pokemon.artwork,
        },
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: pokemon.name,
              },
            },
          ],
        },
        Category: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: pokemon.category,
              },
            },
          ],
        },
        No: {
          number: pokemon.number,
        },
        Type: {
          multi_select: pokemon.types,
        },
        Generation: {
          select: {
            name: pokemon.generation,
          },
        },
        Sprite: {
          files: [
            {
              type: 'external',
              name: 'Pokemon Sprite',
              external: {
                url: pokemon.sprite,
              },
            },
          ],
        },
        Height: { number: pokemon.height },
        Weight: { number: pokemon.weight },
        HP: { number: pokemon.hp },
        Attack: { number: pokemon.attack },
        Defense: { number: pokemon.defense },
        'Sp. Attack': { number: pokemon['special-attack'] },
        'Sp. Defense': { number: pokemon['special-defense'] },
        Speed: { number: pokemon.speed },
      },
      children: [
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: pokemon['flavor-text'],
                },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '',
                },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: "View This Pokémon's Entry on Bulbapedia:",
                },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'bookmark',
          bookmark: {
            url: pokemon.bulbURL,
          },
        },
      ],
    };
    await sleep(300);
    console.log(`Sending ${pokemon.name} to Notion`);
    try {
      const response = await notion.pages.create(data);
      console.log(response);
    } catch (error) {
      console.error(`Error creating Notion page for ${pokemon.name}: ${error}`);
    }
  }
  console.log(`Operation complete.`);
}
