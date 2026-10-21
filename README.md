# ReStruct: Inference-Time Robot Behavior Steering through Physically-Aware Reconfiguration of Task-Structure

**Conference on Robot Learning (CoRL) 2026** · [Project page](https://pyywill.github.io/restruct-corl2026/) · [arXiv:2606.26588](https://arxiv.org/abs/2606.26588) · [OpenReview](https://openreview.net/forum?id=NCeeEHy8d5)

Yiyuan Pan, Hanjiang Hu, Shangtao Li, Xusheng Luo\*, Changliu Liu\* · Robotics Institute, Carnegie Mellon University

ReStruct is an inference-time policy steering method for robot manipulation. A preference stated in plain language is compiled into a temporal-logic (LTL<sub>f</sub>) automaton and merged into the learned state machine of a neural automaton policy ([ENAP](https://intelligent-control-lab.github.io/ENAP-project-webpage/), RSS 2026). The low-level controller stays frozen, so the policy follows the preference without retraining.

This repository hosts the project page, a static site served by GitHub Pages from the repository root (`index.html`). The 3D replays use recorded ManiSkill rollouts stored under `data/`; three.js is loaded from a CDN. Code release: coming soon.

## Citation

```bibtex
@article{pan2026inference,
  title={Inference-Time Robot Behavior Steering through Physically-Aware Reconfiguration of Task-Structure},
  author={Pan, Yiyuan and Hu, Hanjiang and Li, Shangtao and Luo, Xusheng and Liu, Changliu},
  journal={arXiv preprint arXiv:2606.26588},
  year={2026}
}
```
