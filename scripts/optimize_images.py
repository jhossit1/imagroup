"""Genera WebP optimizados en public/img desde drive_originales (los originales no se tocan).
Uso: python scripts/optimize_images.py"""
import os, glob
from PIL import Image, ImageOps
R = 'drive_originales'; O = 'public/img'
def save(src, dst, w, sq=False):
    im = ImageOps.exif_transpose(Image.open(src))
    im = im.convert('RGBA' if im.mode in ('RGBA','LA','P') else 'RGB')
    if sq: im = ImageOps.fit(im, (w, w), Image.LANCZOS) if im.mode=='RGB' else im
    if 'A' in im.mode:
        bb = im.getbbox(); im = im.crop(bb) if bb else im
    im.thumbnail((w, w*2), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=78, method=6)
def one(pat):
    m = glob.glob(os.path.join(R, pat)); assert m, pat; return m[0]
FIELD = {  # nombre -> patron en drive_originales/campo (origen: Drive MULTIMEDIA)
 'vial-1':'campo/Mantenimiento*M2.jpg','vial-2':'campo/Mantenimiento*M3.jpg',
 'residuos-1':'campo/estudio*FB*','residuos-2':'campo/estudio*095945286*',
 'organicos-1':'campo/ESTABILIZACI*E2.jpg','educacion-1':'campo/educacion*101953986*',
 'educacion-2':'campo/educacion*144149470*','agua-1':'campo/monitoreo*WA0044*',
 'agua-2':'campo/monitoreo*WA0021*','agua-3':'campo/monitoreo*133808015*',
 'solar-1':'campo/instalacion*172633026*','solar-2':'campo/instalacion*094154503*',
 'hidro-1':'campo/sistemas_de_cultivo*153140620*','biogas-1':'campo/sistemas_de_producion*BIO4*',
}
PROD = {'botas':'BOTAS','camisa-outdoor':'CAMISA OUTDOOR','casco':'CASCOS','chaleco-rojo':'de CHALECO.',
 'guantes':'GUANTES','juego-seguridad':'JUEGO DE','polo-lurawi':'POLO LURAWI','poncho':'PONCHO',
 'silbato':'SILBATO','chaleco-multibolsillo':'chalecos seguridad','pantalon':'pantalones',
 'respirador':'respiratorio','zapatos':'zapatos de','polo-ml-deporte':'manga larga deporte','polo-ml':'polos manga larga.'}
BRAND = {'imagroup':'logo imagroup__imagroup.png','gregorian-h':'Formato de Logotipo 10.png',
 'gregorian-sq':'Formato de Logotipo SVG 1.png','gregorian-w':'Formato de Logotipo PNG 16.png',
 'gregorian-icon':'IMG_1429.PNG','ing-perfil':'SSOMA3.png'}
if __name__ == '__main__':
    for k, p in FIELD.items():
        s = one(p); save(s, f'{O}/f/{k}.webp', 1600); save(s, f'{O}/f/{k}-sm.webp', 720)
    for k, p in PROD.items():
        s = one('1 Equipos*' + p + '*'); save(s, f'{O}/p/{k}.webp', 900)
    for k, p in BRAND.items():
        save(one(p), f'{O}/brand/{k}.webp', 900)
    print('ok')
