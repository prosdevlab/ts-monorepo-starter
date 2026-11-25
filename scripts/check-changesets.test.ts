import { describe, expect, it } from 'vitest';
import { checkChangesets, releasablePackages } from './check-changesets.mjs';

const packages = new Set(['pkg-a', '@scope/pkg-b']);
const check = (files: Record<string, string>) =>
  checkChangesets(new Map(Object.entries(files)), packages);

describe('checkChangesets', () => {
  it('accepts a valid changeset, quoted or not, and an empty one', () => {
    expect(
      check({
        'a.md': '---\n"pkg-a": patch\n---\n\nFixes a thing.\n',
        'b.md': "---\n'@scope/pkg-b': minor\n---\n\nAdds a thing.\n",
        'c.md': '---\n---\n',
      })
    ).toEqual([]);
  });

  it('rejects frontmatter a Markdown formatter turned into a heading', () => {
    // The shape that reached a release: `"pkg": minor` above `---` reads as a setext heading.
    const problems = check({ 'bad.md': '---\n\n## "pkg-a": minor\n\nFixes a thing.\n' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^bad\.md: .*frontmatter/);
  });

  it('rejects a release for a package the workspace does not have', () => {
    expect(check({ 'typo.md': '---\n"pkg-aa": patch\n---\n\nFixes a thing.\n' })).toEqual([
      'typo.md: no package named pkg-aa in this workspace',
    ]);
  });

  it('reports every bad file, not only the first', () => {
    const problems = check({
      'one.md': '---\n"nope": patch\n---\n\nx\n',
      'two.md': 'no frontmatter at all\n',
    });
    expect(problems.map((p) => p.split(':')[0])).toEqual(['one.md', 'two.md']);
  });
});

describe('releasablePackages', () => {
  it('leaves out the workspace root, which Changesets refuses to release', () => {
    const listed = [{ name: 'my-workspace' }, { name: 'pkg-a' }, { name: '@scope/pkg-b' }];
    const allowed = releasablePackages(listed, 'my-workspace');
    expect([...allowed]).toEqual(['pkg-a', '@scope/pkg-b']);
    expect(
      checkChangesets(new Map([['root.md', '---\n"my-workspace": patch\n---\n\nx\n']]), allowed)
    ).toEqual(['root.md: no package named my-workspace in this workspace']);
  });
});
