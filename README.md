# ReViT: Rotational-equivariant Vision Transformers for Neural PDE Solvers

### [Project Page](https://tum-pbs.github.io/revit-web/) | [Paper](https://ge.in.tum.de/download/wei-icml2026-revit.pdf) | [Code](https://github.com/tum-pbs/revit)

**Oral at ICML 2026**

[Hao Wei](https://howw-way.github.io/personal-web/), [Bjoern List](https://ge.in.tum.de/about/bjorn-list/), [Nils Thuerey](https://ge.in.tum.de/about/n-thuerey/)

Technical University of Munich

---

**ReViT** is the first Vision Transformer framework that enforces strict rotational equivariance on grid-based physical fields. By mapping scalar and vector inputs into locally invariant representations derived from physics-based canonical bases, ReViT enables standard self-attention without symmetry violations — yielding significant accuracy gains across 2D and 3D PDE benchmarks.

## Highlights

- **Strict rotational equivariance** for Vision Transformers on grid-based PDE data
- **Local canonicalization** via physics-based canonical bases — no group lifting needed
- **Up to 65% MSE reduction** over state-of-the-art baselines on 3D turbulence benchmarks
- **~53× memory reduction** compared to lifted equivariant alternatives
- Exact chiral octahedral group *O* equivariance and approximate *SO(3)* equivariance

## Citation

```bibtex
@inproceedings{ReViT2026,
  title     = {{ReViT}: Rotational-equivariant Vision Transformers for Neural {PDE} Solvers},
  author    = {Hao Wei and Bjoern List and Nils Thuerey},
  booktitle = {Forty-Third International Conference on Machine Learning},
  year      = {2026},
}
```

## Acknowledgments

This project page template is borrowed from [Nerfies](https://nerfies.github.io/).
