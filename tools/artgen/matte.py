"""Cut sprites out with BiRefNet (ZhengPeng7/BiRefNet, MIT), where artgen.py's border flood fill fails: white that is
enclosed (the gap between an arm and the body) stays white, and a white object touching the background (an enamel bowl)
is cut away with it. Each sprite is put back on white, BiRefNet predicts the subject's mask, and that mask becomes the
alpha. Writes <name>_matte.png beside each input; the input is kept.

    uv run --project C:/Dev/yoruba_student_dict_platform/imagegen --with timm --with kornia --with einops \
        python tools/artgen/matte.py FILE.png [FILE.png ...]"""
import sys
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

sys.path.insert(0, str(Path(__file__).parent))
from gpulock import gpu_lock  # noqa: E402

SIZE = 1024
prep = transforms.Compose([transforms.Resize((SIZE, SIZE)), transforms.ToTensor(),
                           transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

with gpu_lock():
    model = AutoModelForImageSegmentation.from_pretrained("ZhengPeng7/BiRefNet", trust_remote_code=True)
    model.to("cuda").eval().half()
    for name in sys.argv[1:]:
        src = Image.open(name).convert("RGBA")
        flat = Image.new("RGB", src.size, "white")
        flat.paste(src, mask=src.split()[3])
        with torch.no_grad():
            pred = model(prep(flat).unsqueeze(0).to("cuda").half())[-1].sigmoid().float().cpu()[0, 0]
        mask = transforms.functional.to_pil_image(pred).resize(src.size, Image.BILINEAR)
        out = flat.convert("RGBA")
        out.putalpha(mask)
        dst = Path(name).with_name(Path(name).stem + "_matte.png")
        out.save(dst)
        print("wrote", dst)
