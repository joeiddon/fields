# hacky script to generate links to all simulations and add to readme

import os

# os.walk would have been a better way than this!
def get_index_paths(relative_loc=''):
    paths = []
    for f in (x for x in os.listdir(relative_loc or None) if x[0] != '.'):
        relative_path = os.path.join(relative_loc, f)
        if os.path.isdir(relative_path):
            paths += get_index_paths(relative_path)
        elif f == 'index.html':
            paths.append(relative_path)
        #else:
        #    print('discarding', os.path.join(relative_loc, f))
    return paths

links = sorted(get_index_paths())

for link in links:
    open('README.md', 'a').write(
        'https://joeiddon.github.io/fields/' + link + '\n\n'
    )
