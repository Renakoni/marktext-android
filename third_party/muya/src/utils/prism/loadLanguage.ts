import components from 'prismjs/components.js';
import getLoader from 'prismjs/dependencies';

interface ILangLoadStatus {
    lang: string;
    status: 'noexist' | 'cached' | 'loaded';
}
/**
 * The set of all languages which have been loaded using the below function.
 *
 * @type {Set<string>}
 */
export const loadedLanguages = new Set([
    'markup',
    'css',
    'clike',
    'javascript',
]);

const { languages } = components;
const languageModules = import.meta.glob([
    '../../../node_modules/prismjs/components/prism-*.js',
    '!../../../node_modules/prismjs/components/prism-*.min.js',
]) as Record<string, () => Promise<unknown>>;

function getLanguageModule(lang: string) {
    const modulePath = `../../../node_modules/prismjs/components/prism-${lang}.js`;
    return languageModules[modulePath]
        ?? Object.entries(languageModules).find(([path]) => path.endsWith(`/prism-${lang}.js`))?.[1];
}

// Look for the origin language by alias
export function transformAliasToOrigin(langs: string[]) {
    const result = [];

    for (const lang of langs) {
        if (languages[lang]) {
            result.push(lang);
        }
        else {
            const language = Object.keys(languages).find((name) => {
                const l = languages[name];
                if (l.alias) {
                    return (
                        l.alias === lang
                        || (Array.isArray(l.alias) && l.alias.includes(lang))
                    );
                }

                return false;
            });

            if (language) {
                result.push(language);
            }
            else {
                // The lang is not exist, the will handle in `initLoadLanguage`
                result.push(lang);
            }
        }
    }

    return result;
}

// Minimal Prism surface this module needs — full Prism typings live in
// prismjs's external @types package, but we only read `languages` here.
interface IPrismLike {
    languages: Record<string, unknown>;
}

function initLoadLanguage(Prism: IPrismLike) {
    return async function loadLanguages(langs?: string[] | string) {
    // If no argument is passed, load all components
        if (!langs)
            langs = Object.keys(languages).filter(lang => lang !== 'meta');

        if (langs && !langs.length) {
            return Promise.reject(
                new Error(
                    'The first parameter should be a list of load languages or single language.',
                ),
            );
        }

        if (!Array.isArray(langs))
            langs = [langs];

        const statuses: ILangLoadStatus[] = [];
        // The user might have loaded languages via some other way or used `prism.js` which already includes some
        // We don't need to validate the ids because `getLoader` will ignore invalid ones
        const loaded = [...loadedLanguages, ...Object.keys(Prism.languages)];
        const loadComponent = async (lang: string): Promise<void> => {
            if (!(lang in components.languages)) {
                statuses.push({ lang, status: 'noexist' });
                return;
            }
            if (loadedLanguages.has(lang)) {
                statuses.push({ lang, status: 'cached' });
                return;
            }

            delete Prism.languages[lang];
            const loadLanguageModule = getLanguageModule(lang);
            if (!loadLanguageModule) {
                throw new Error(`Prism language module not found: ${lang}`);
            }

            await loadLanguageModule();
            loadedLanguages.add(lang);
            statuses.push({ lang, status: 'loaded' });
        };

        await getLoader(components, langs, loaded).load(loadComponent, {
            series: (before: Promise<void>, after: () => Promise<void>) =>
                before.then(after),
            parallel: (values: Promise<void>[]) => Promise.all(values),
        });

        return statuses;
    };
}

export default initLoadLanguage;
