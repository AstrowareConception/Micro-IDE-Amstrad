import { expect } from '@playwright/test';

export async function verifyMissionLibrary(page, panel, kind = 'basic') {
  const objective = panel.getByLabel('Mission de programmation', { exact: true });
  await objective.fill('Ma consigne à conserver.');
  const open = () => panel.getByRole('button', { name: 'Choisir une mission…', exact: true }).click();
  await open();
  const dialog = page.getByRole('dialog', { name: 'Bibliothèque de missions', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Bibliothèque de missions', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Rechercher un modèle', { exact: true })).toBeFocused();
  await expect(dialog).not.toContainText(kind === 'basic' ? 'Modifier une zone Z80' : 'Créer un écran de titre BASIC');
  if (kind === 'binary') {
    await expect(dialog).toContainText('Expliquer une routine Z80');
    await dialog.getByRole('button', { name: 'Remplacer ma mission', exact: true }).click();
    await expect(objective).toHaveValue(/Conserve exactement le listing et les octets/);
    await panel.getByRole('button', { name: 'Rétablir la mission précédente', exact: true }).click();
    await expect(objective).toHaveValue('Ma consigne à conserver.');
    return;
  }
  await dialog.getByLabel('Rechercher un modèle', { exact: true }).fill('inexistant');
  await expect(dialog).toContainText('Aucun modèle ne correspond');
  await dialog.getByLabel('Rechercher un modèle', { exact: true }).fill('ecran');
  await dialog.getByRole('button', { name: /Créer un écran de titre BASIC/ }).click();
  await dialog.getByLabel('Objectif et contraintes', { exact: true }).fill('Un titre Mahjong en MODE 1, bleu et ivoire.');
  await expect(dialog.getByRole('button', { name: 'Remplacer ma mission', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Générer l’aperçu', exact: true }).click();
  const preview = dialog.getByLabel('Aperçu modifiable', { exact: true });
  await expect(preview).toHaveValue(/Un titre Mahjong en MODE 1/);
  const prompt = `${await preview.inputValue()}\nMa précision personnelle.`;
  await preview.fill(prompt);
  for (const viewport of [{ width: 420, height: 740 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  }
  await preview.evaluate(el => { el.scrollTop = 0; el.blur(); });
  await dialog.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'out/mission-library-alpha.png' });
  await dialog.getByText('Conserver comme modèle personnel', { exact: true }).click();
  await dialog.getByLabel('Nom du modèle', { exact: true }).fill('Mon écran Mahjong');
  await dialog.getByRole('button', { name: 'Enregistrer une copie', exact: true }).click();
  await expect(dialog).toContainText('Modèle enregistré sur cet ordinateur.');
  await dialog.getByRole('button', { name: 'Ajouter à ma mission', exact: true }).click();
  await expect(objective).toHaveValue(`Ma consigne à conserver.\n\n${prompt}`);
  await panel.getByRole('button', { name: 'Rétablir la mission précédente', exact: true }).click();
  await expect(objective).toHaveValue('Ma consigne à conserver.');
  await open();
  await dialog.getByLabel('Catégorie', { exact: true }).selectOption('Mes modèles');
  await dialog.getByRole('button', { name: /Mon écran Mahjong/ }).click();
  await expect(preview).toHaveValue(prompt);
  await dialog.getByText('Conserver comme modèle personnel', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Supprimer ce modèle', exact: true }).click();
  await expect(dialog).toContainText('Aucun modèle ne correspond');
  await dialog.getByRole('button', { name: 'Rétablir le modèle supprimé', exact: true }).click();
  await dialog.getByRole('button', { name: /Mon écran Mahjong/ }).click();
  await preview.fill(`${prompt}\nVersion révisée.`);
  await dialog.getByRole('button', { name: 'Mettre à jour ce modèle', exact: true }).click();
  await expect(dialog).toContainText('Modèle mis à jour');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Choisir une mission…', exact: true })).toBeFocused();
  await expect(objective).toHaveValue('Ma consigne à conserver.');
  await page.reload();
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  await open();
  await dialog.getByRole('button', { name: /Mon écran Mahjong/ }).click();
  await expect(preview).toHaveValue(`${prompt}\nVersion révisée.`);
  await dialog.getByRole('button', { name: 'Utiliser cette mission', exact: true }).click();
  await expect(objective).toHaveValue(`${prompt}\nVersion révisée.`);
  await expect.poll(() => page.evaluate(() => window.agentCalls.length)).toBe(0);
}
